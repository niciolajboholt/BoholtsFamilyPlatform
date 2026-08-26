using System.Windows.Input;
using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Services;

namespace Filnavnevaerktoej.App.ViewModels;

public enum WizardStep
{
    VaelgFiler,
    KonfigurerRegler,
    Bekraeftelse,
    Resultat
}

/// <summary>Overordnet orkestrering af wizardens fire trin.</summary>
public sealed class WizardViewModel : BaseViewModel
{
    private readonly IFileDiscoveryService _fileDiscovery;
    private readonly IRenameService _renameService;
    private readonly IHistoryService _historyService;
    private readonly IReportService _reportService;
    private readonly IAppLogger _logger;

    private WizardStep _currentStep = WizardStep.VaelgFiler;
    private RenameOperation? _senesteOperation;

    public WizardViewModel(
        IFileDiscoveryService fileDiscovery,
        IRenameService renameService,
        IHistoryService historyService,
        IProfileService profileService,
        IReportService reportService,
        IAppLogger logger)
    {
        _fileDiscovery = fileDiscovery;
        _renameService = renameService;
        _historyService = historyService;
        _reportService = reportService;
        _logger = logger;

        SelectFolderViewModel = new SelectFolderViewModel(fileDiscovery, logger);
        ConfigureRulesViewModel = new ConfigureRulesViewModel(renameService, profileService, SelectFolderViewModel, logger);
        ConfirmationViewModel = new ConfirmationViewModel();
        ResultViewModel = new ResultViewModel();
        HistoryViewModel = new HistoryViewModel(historyService);

        SelectFolderViewModel.TilstandAendret += (_, _) => OnPropertyChanged(nameof(KanGaaFrem));
        ConfigureRulesViewModel.TilstandAendret += (_, _) => OnPropertyChanged(nameof(KanGaaFrem));

        ConfirmationViewModel.TilbageAnmodet += (_, _) => CurrentStep = WizardStep.KonfigurerRegler;
        ConfirmationViewModel.AnnullerAnmodet += (_, _) => AnnullerAnmodet?.Invoke(this, EventArgs.Empty);
        ConfirmationViewModel.OmdoebGodkendt += async (_, _) => await UdfoerOmdoebningAsync().ConfigureAwait(true);

        ResultViewModel.AabenMappeAnmodet += (_, _) => AabenMappeAnmodet?.Invoke(this, SelectFolderViewModel.MappeSti);
        ResultViewModel.GemRapportAnmodet += async (_, _) => await GemRapportAsync().ConfigureAwait(true);
        ResultViewModel.FortrydAnmodet += async (_, _) => await FortrydSenesteAsync().ConfigureAwait(true);
        ResultViewModel.StartForfraAnmodet += (_, _) => StartForfra();
        ResultViewModel.LukAnmodet += (_, _) => LukAnmodet?.Invoke(this, EventArgs.Empty);

        HistoryViewModel.FortrydAnmodet += async (_, operation) => await FortrydOperationAsync(operation).ConfigureAwait(true);

        NaesteCommand = new AsyncRelayCommand(GaaFremAsync, () => KanGaaFrem);
        TilbageCommand = new RelayCommand(GaaTilbage, () => KanGaaTilbage);
        AnnullerCommand = new RelayCommand(() => AnnullerAnmodet?.Invoke(this, EventArgs.Empty));
    }

    public SelectFolderViewModel SelectFolderViewModel { get; }
    public ConfigureRulesViewModel ConfigureRulesViewModel { get; }
    public ConfirmationViewModel ConfirmationViewModel { get; }
    public ResultViewModel ResultViewModel { get; }
    public HistoryViewModel HistoryViewModel { get; }

    public ICommand NaesteCommand { get; }
    public ICommand TilbageCommand { get; }
    public ICommand AnnullerCommand { get; }

    /// <summary>Sat af View'et - viser en Windows-mappevælger og returnerer den valgte sti (eller null).</summary>
    public Func<string, string?> VisMappeDialog
    {
        get => SelectFolderViewModel.VisMappeDialog;
        set => SelectFolderViewModel.VisMappeDialog = value;
    }

    /// <summary>Sat af View'et - viser en Gem som-dialog for CSV-rapporten og returnerer den valgte sti (eller null).</summary>
    public Func<string?>? VisGemRapportDialog { get; set; }

    /// <summary>Sat af View'et - viser en bekræft/annuller-dialog med forhåndsvisning af en fortrydelse. True = fortsæt.</summary>
    public Func<IReadOnlyList<RenamePreviewItem>, bool>? VisFortrydForhaandsvisning { get; set; }

    /// <summary>Sat af View'et - viser en simpel informations-/fejlbesked til brugeren.</summary>
    public Action<string, bool>? VisBesked { get; set; }

    public event EventHandler? AnnullerAnmodet;
    public event EventHandler? LukAnmodet;
    public event EventHandler<string>? AabenMappeAnmodet;

    public WizardStep CurrentStep
    {
        get => _currentStep;
        private set
        {
            if (SetProperty(ref _currentStep, value))
            {
                OnPropertyChanged(nameof(KanGaaFrem));
                OnPropertyChanged(nameof(KanGaaTilbage));
                OnPropertyChanged(nameof(ErOpsaetningIGang));
                OnPropertyChanged(nameof(CurrentContent));
                OnPropertyChanged(nameof(ErSidsteTrin));
                OnPropertyChanged(nameof(VisGlobalNavigation));
            }
        }
    }

    /// <summary>Den aktive trin-ViewModel, som MainWindow viser via en DataTemplate pr. type.</summary>
    public object CurrentContent => CurrentStep switch
    {
        WizardStep.VaelgFiler => SelectFolderViewModel,
        WizardStep.KonfigurerRegler => ConfigureRulesViewModel,
        WizardStep.Bekraeftelse => ConfirmationViewModel,
        WizardStep.Resultat => ResultViewModel,
        _ => SelectFolderViewModel
    };

    public bool ErSidsteTrin => CurrentStep == WizardStep.Resultat;

    /// <summary>Den fælles bundnavigation vises kun på trin 1 og 2 - trin 3 og 4 har deres egne knapper.</summary>
    public bool VisGlobalNavigation => CurrentStep is WizardStep.VaelgFiler or WizardStep.KonfigurerRegler;

    public bool KanGaaFrem => CurrentStep switch
    {
        WizardStep.VaelgFiler => SelectFolderViewModel.KanGaaVidere,
        WizardStep.KonfigurerRegler => ConfigureRulesViewModel.KanGaaVidere,
        _ => false
    };

    public bool KanGaaTilbage => CurrentStep is WizardStep.KonfigurerRegler or WizardStep.Bekraeftelse;

    /// <summary>Bruges til at vise en bekræftelse ved lukning, hvis der er en igangværende, ugemt opsætning.</summary>
    public bool ErOpsaetningIGang =>
        CurrentStep is WizardStep.KonfigurerRegler or WizardStep.Bekraeftelse
        || (CurrentStep == WizardStep.VaelgFiler && SelectFolderViewModel.FundneFiler.Count > 0);

    private async Task GaaFremAsync()
    {
        switch (CurrentStep)
        {
            case WizardStep.VaelgFiler:
                CurrentStep = WizardStep.KonfigurerRegler;
                await ConfigureRulesViewModel.OpdaterForhaandsvisningAsync().ConfigureAwait(true);
                break;

            case WizardStep.KonfigurerRegler:
                var aendrede = ConfigureRulesViewModel.Forhaandsvisning
                    .Where(i => i.AendresRentFaktisk && i.Status != RenameStatus.Fejl)
                    .ToList();
                ConfirmationViewModel.Opdater(aendrede);
                CurrentStep = WizardStep.Bekraeftelse;
                break;
        }
    }

    private void GaaTilbage()
    {
        CurrentStep = CurrentStep switch
        {
            WizardStep.KonfigurerRegler => WizardStep.VaelgFiler,
            WizardStep.Bekraeftelse => WizardStep.KonfigurerRegler,
            _ => CurrentStep
        };
    }

    private async Task UdfoerOmdoebningAsync()
    {
        ConfirmationViewModel.UdfoererNu = true;
        ConfirmationViewModel.FremdriftBesked = "Kontrollerer filer...";
        ConfirmationViewModel.FremdriftProcent = 0;

        try
        {
            var valgteAendringer = ConfigureRulesViewModel.Forhaandsvisning
                .Where(i => i.AendresRentFaktisk && i.Status != RenameStatus.Fejl)
                .ToList();

            var progress = new Progress<RenameFremdrift>(f =>
            {
                ConfirmationViewModel.FremdriftBesked = f.Besked;
                ConfirmationViewModel.FremdriftProcent = f.Total == 0 ? 0 : 100.0 * f.Behandlet / f.Total;
            });

            var operation = await _renameService.UdfoerAsync(
                valgteAendringer,
                SelectFolderViewModel.MappeSti,
                ConfigureRulesViewModel.TilladAendringAfFilendelser,
                progress).ConfigureAwait(true);

            _senesteOperation = operation;
            ResultViewModel.Opdater(operation, kanFortryde: operation.AntalOmdoebt > 0 && !operation.ErFortrudt);
            CurrentStep = WizardStep.Resultat;
        }
        catch (Exception ex)
        {
            _logger.Fejl("Uventet fejl under omdøbning.", ex);
            VisBesked?.Invoke($"Der opstod en uventet fejl under omdøbningen: {ex.Message}", true);
        }
        finally
        {
            ConfirmationViewModel.UdfoererNu = false;
        }
    }

    private async Task GemRapportAsync()
    {
        if (_senesteOperation is null || VisGemRapportDialog is null)
            return;

        var sti = VisGemRapportDialog();
        if (sti is null)
            return;

        try
        {
            await _reportService.GemCsvRapportAsync(_senesteOperation, sti).ConfigureAwait(true);
            VisBesked?.Invoke($"Rapporten er gemt: {sti}", false);
        }
        catch (Exception ex)
        {
            _logger.Fejl("Kunne ikke gemme rapport.", ex);
            VisBesked?.Invoke($"Rapporten kunne ikke gemmes: {ex.Message}", true);
        }
    }

    private async Task FortrydSenesteAsync()
    {
        if (_senesteOperation is null)
            return;

        await FortrydOperationAsync(_senesteOperation).ConfigureAwait(true);
    }

    private async Task FortrydOperationAsync(RenameOperation operation)
    {
        var forhaandsvisning = _renameService.GenererFortrydelsesForhaandsvisning(operation);
        if (forhaandsvisning.Count == 0)
        {
            VisBesked?.Invoke("Der er ingen filer, der kan fortrydes fra denne operation.", true);
            return;
        }

        var fortsaet = VisFortrydForhaandsvisning?.Invoke(forhaandsvisning) ?? false;
        if (!fortsaet)
            return;

        try
        {
            var fortrydelsesOperation = await _renameService.FortrydAsync(operation).ConfigureAwait(true);
            ResultViewModel.Opdater(fortrydelsesOperation, kanFortryde: false);
            CurrentStep = WizardStep.Resultat;
            await HistoryViewModel.IndlaesAsync().ConfigureAwait(true);
            VisBesked?.Invoke(
                $"Fortrydelse gennemført: {fortrydelsesOperation.AntalOmdoebt} fil(er) fik deres oprindelige navn tilbage, {fortrydelsesOperation.AntalFejlet} fejlede.",
                fortrydelsesOperation.AntalFejlet > 0);
        }
        catch (Exception ex)
        {
            _logger.Fejl("Uventet fejl under fortrydelse.", ex);
            VisBesked?.Invoke($"Der opstod en uventet fejl under fortrydelsen: {ex.Message}", true);
        }
    }

    private void StartForfra()
    {
        SelectFolderViewModel.MappeSti = string.Empty;
        SelectFolderViewModel.FilFilter = "*.*";
        SelectFolderViewModel.MedtagUndermapper = false;
        SelectFolderViewModel.MedtagSkjulteFiler = false;
        SelectFolderViewModel.MedtagSystemfiler = false;
        SelectFolderViewModel.FundneFiler.Clear();

        ConfigureRulesViewModel.SletRegel.ErAktiveret = false;
        ConfigureRulesViewModel.ErstatRegel.ErAktiveret = false;
        ConfigureRulesViewModel.TilfoejRegel.ErAktiveret = false;
        ConfigureRulesViewModel.RegexRegel.ErAktiveret = false;
        ConfigureRulesViewModel.StoreSmaaRegel.ErAktiveret = false;
        ConfigureRulesViewModel.NummereringRegel.ErAktiveret = false;
        ConfigureRulesViewModel.TilladAendringAfFilendelser = false;
        ConfigureRulesViewModel.Forhaandsvisning.Clear();

        _senesteOperation = null;
        CurrentStep = WizardStep.VaelgFiler;
    }
}
