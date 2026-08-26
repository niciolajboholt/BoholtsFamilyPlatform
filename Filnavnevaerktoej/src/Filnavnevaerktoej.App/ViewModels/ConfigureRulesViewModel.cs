using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows.Data;
using System.Windows.Input;
using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Rules;
using Filnavnevaerktoej.Core.Services;

namespace Filnavnevaerktoej.App.ViewModels;

public enum ForhaandsvisningsFilter
{
    Alle,
    KunAendringer,
    KunFejl,
    KunUaendrede,
    KunAdvarsler
}

/// <summary>Trin 2: opsætning af omdøbningsregler og levende forhåndsvisning.</summary>
public sealed class ConfigureRulesViewModel : BaseViewModel
{
    private readonly IRenameService _renameService;
    private readonly IProfileService _profileService;
    private readonly SelectFolderViewModel _selectFolderViewModel;
    private readonly IAppLogger _logger;
    private readonly System.Timers.Timer _debounceTimer;

    private bool _tilladAendringAfFilendelser;
    private ForhaandsvisningsFilter _aktivtFilter = ForhaandsvisningsFilter.Alle;
    private string _soegetekst = string.Empty;
    private string _profilNavnInput = string.Empty;
    private string? _valgtProfilNavn;
    private string? _regexFejlBesked;
    private string? _profilStatusBesked;

    public ConfigureRulesViewModel(
        IRenameService renameService,
        IProfileService profileService,
        SelectFolderViewModel selectFolderViewModel,
        IAppLogger logger)
    {
        _renameService = renameService;
        _profileService = profileService;
        _selectFolderViewModel = selectFolderViewModel;
        _logger = logger;

        SletRegel = new DeleteTextRule { ErAktiveret = false };
        ErstatRegel = new ReplaceTextRule { ErAktiveret = false };
        TilfoejRegel = new AddTextRule { ErAktiveret = false };
        RegexRegel = new RegexRenameRule { ErAktiveret = false };
        StoreSmaaRegel = new CaseChangeRule { ErAktiveret = false };
        NummereringRegel = new NumberingRule { ErAktiveret = false };

        AbonnerPaaRegelAendringer();

        ForhaandsvisningVisning = CollectionViewSource.GetDefaultView(Forhaandsvisning);
        ForhaandsvisningVisning.Filter = FiltrerElement;

        _debounceTimer = new System.Timers.Timer(300) { AutoReset = false };
        _debounceTimer.Elapsed += (_, _) => System.Windows.Application.Current?.Dispatcher.Invoke(() => _ = OpdaterForhaandsvisningAsync());

        GemProfilCommand = new AsyncRelayCommand(GemProfilAsync, () => !string.IsNullOrWhiteSpace(ProfilNavnInput));
        IndlaesProfilCommand = new AsyncRelayCommand(IndlaesProfilAsync, () => ValgtProfilNavn is not null);
        OmdoebProfilCommand = new AsyncRelayCommand(OmdoebProfilAsync, () => ValgtProfilNavn is not null && !string.IsNullOrWhiteSpace(ProfilNavnInput));
        SletProfilCommand = new AsyncRelayCommand(SletProfilAsync, () => ValgtProfilNavn is not null);

        _ = IndlaesProfilNavneAsync();
    }

    public DeleteTextRule SletRegel { get; }
    public ReplaceTextRule ErstatRegel { get; }
    public AddTextRule TilfoejRegel { get; }
    public RegexRenameRule RegexRegel { get; }
    public CaseChangeRule StoreSmaaRegel { get; }
    public NumberingRule NummereringRegel { get; }

    public ObservableCollection<RenamePreviewItem> Forhaandsvisning { get; } = new();
    public ICollectionView ForhaandsvisningVisning { get; }
    public ObservableCollection<string> ProfilNavne { get; } = new();

    public ICommand GemProfilCommand { get; }
    public ICommand IndlaesProfilCommand { get; }
    public ICommand OmdoebProfilCommand { get; }
    public ICommand SletProfilCommand { get; }

    public event EventHandler? TilstandAendret;

    public bool TilladAendringAfFilendelser
    {
        get => _tilladAendringAfFilendelser;
        set
        {
            if (SetProperty(ref _tilladAendringAfFilendelser, value))
                PlanlaegOpdatering();
        }
    }

    public ForhaandsvisningsFilter AktivtFilter
    {
        get => _aktivtFilter;
        set
        {
            if (SetProperty(ref _aktivtFilter, value))
                ForhaandsvisningVisning.Refresh();
        }
    }

    public string Soegetekst
    {
        get => _soegetekst;
        set
        {
            if (SetProperty(ref _soegetekst, value ?? string.Empty))
                ForhaandsvisningVisning.Refresh();
        }
    }

    public string ProfilNavnInput
    {
        get => _profilNavnInput;
        set => SetProperty(ref _profilNavnInput, value ?? string.Empty);
    }

    public string? ValgtProfilNavn
    {
        get => _valgtProfilNavn;
        set => SetProperty(ref _valgtProfilNavn, value);
    }

    public string? RegexFejlBesked
    {
        get => _regexFejlBesked;
        private set => SetProperty(ref _regexFejlBesked, value);
    }

    public string? ProfilStatusBesked
    {
        get => _profilStatusBesked;
        private set => SetProperty(ref _profilStatusBesked, value);
    }

    public int AntalFundet => Forhaandsvisning.Count;
    public int AntalAendres => Forhaandsvisning.Count(i => i.Status == RenameStatus.AendresGyldigt);
    public int AntalUaendret => Forhaandsvisning.Count(i => i.Status == RenameStatus.Uaendret);
    public int AntalFejl => Forhaandsvisning.Count(i => i.Status == RenameStatus.Fejl);
    public int AntalAdvarsler => Forhaandsvisning.Count(i => i.Status == RenameStatus.Advarsel);

    public bool KanGaaVidere => RegexFejlBesked is null && AntalFejl == 0 && AntalAendres + AntalAdvarsler > 0;

    private void AbonnerPaaRegelAendringer()
    {
        foreach (var regel in AlleRegler())
            regel.PropertyChanged += (_, _) => PlanlaegOpdatering();
    }

    private IEnumerable<IRenameRule> AlleRegler()
    {
        yield return SletRegel;
        yield return ErstatRegel;
        yield return TilfoejRegel;
        yield return RegexRegel;
        yield return StoreSmaaRegel;
        yield return NummereringRegel;
    }

    public void PlanlaegOpdatering()
    {
        OpdaterRegexValidering();
        _debounceTimer.Stop();
        _debounceTimer.Start();
    }

    private void OpdaterRegexValidering()
    {
        RegexFejlBesked = RegexRegel.ErAktiveret ? RegexRegel.ValiderMoenster() : null;
    }

    public async Task OpdaterForhaandsvisningAsync()
    {
        var filer = _selectFolderViewModel.FundneFiler.ToList();
        var konfiguration = new RenameConfiguration
        {
            Regler = AlleRegler().ToList(),
            TilladAendringAfFilendelser = TilladAendringAfFilendelser
        };

        var resultat = await Task.Run(() => _renameService.GenererForhaandsvisning(filer, konfiguration)).ConfigureAwait(true);

        Forhaandsvisning.Clear();
        foreach (var item in resultat)
            Forhaandsvisning.Add(item);

        ForhaandsvisningVisning.Refresh();
        OnPropertyChanged(nameof(AntalFundet));
        OnPropertyChanged(nameof(AntalAendres));
        OnPropertyChanged(nameof(AntalUaendret));
        OnPropertyChanged(nameof(AntalFejl));
        OnPropertyChanged(nameof(AntalAdvarsler));
        OnPropertyChanged(nameof(KanGaaVidere));
        TilstandAendret?.Invoke(this, EventArgs.Empty);
    }

    private bool FiltrerElement(object obj)
    {
        if (obj is not RenamePreviewItem item)
            return false;

        var matcherFilter = AktivtFilter switch
        {
            ForhaandsvisningsFilter.Alle => true,
            ForhaandsvisningsFilter.KunAendringer => item.Status == RenameStatus.AendresGyldigt,
            ForhaandsvisningsFilter.KunFejl => item.Status == RenameStatus.Fejl,
            ForhaandsvisningsFilter.KunUaendrede => item.Status == RenameStatus.Uaendret,
            ForhaandsvisningsFilter.KunAdvarsler => item.Status == RenameStatus.Advarsel,
            _ => true
        };

        if (!matcherFilter) return false;
        if (string.IsNullOrWhiteSpace(Soegetekst)) return true;

        return item.GammeltFilnavn.Contains(Soegetekst, StringComparison.OrdinalIgnoreCase)
            || item.NytFilnavn.Contains(Soegetekst, StringComparison.OrdinalIgnoreCase);
    }

    public RenameConfiguration BygKonfiguration() => new()
    {
        Regler = AlleRegler().ToList(),
        TilladAendringAfFilendelser = TilladAendringAfFilendelser
    };

    private async Task IndlaesProfilNavneAsync()
    {
        var profiler = await _profileService.HentAlleProfilerAsync().ConfigureAwait(true);
        ProfilNavne.Clear();
        foreach (var profil in profiler)
            ProfilNavne.Add(profil.Navn);
    }

    private async Task GemProfilAsync()
    {
        var profil = new RenameProfile
        {
            Navn = ProfilNavnInput.Trim(),
            FilFilter = _selectFolderViewModel.FilFilter,
            MedtagUndermapper = _selectFolderViewModel.MedtagUndermapper,
            TilladAendringAfFilendelser = TilladAendringAfFilendelser,
            Regler = AlleRegler().ToList()
        };

        await _profileService.GemProfilAsync(profil).ConfigureAwait(true);
        await IndlaesProfilNavneAsync().ConfigureAwait(true);
        ProfilStatusBesked = $"Profilen '{profil.Navn}' er gemt.";
        _logger.Info($"Profil gemt: '{profil.Navn}'.");
    }

    private async Task IndlaesProfilAsync()
    {
        if (ValgtProfilNavn is null) return;

        var profil = await _profileService.HentProfilAsync(ValgtProfilNavn).ConfigureAwait(true);
        if (profil is null)
        {
            ProfilStatusBesked = "Profilen kunne ikke findes. Den er muligvis blevet slettet.";
            return;
        }

        _selectFolderViewModel.FilFilter = profil.FilFilter;
        _selectFolderViewModel.MedtagUndermapper = profil.MedtagUndermapper;
        TilladAendringAfFilendelser = profil.TilladAendringAfFilendelser;

        KopierRegel(profil.Regler.OfType<DeleteTextRule>().FirstOrDefault(), SletRegel);
        KopierRegel(profil.Regler.OfType<ReplaceTextRule>().FirstOrDefault(), ErstatRegel);
        KopierRegel(profil.Regler.OfType<AddTextRule>().FirstOrDefault(), TilfoejRegel);
        KopierRegel(profil.Regler.OfType<RegexRenameRule>().FirstOrDefault(), RegexRegel);
        KopierRegel(profil.Regler.OfType<CaseChangeRule>().FirstOrDefault(), StoreSmaaRegel);
        KopierRegel(profil.Regler.OfType<NumberingRule>().FirstOrDefault(), NummereringRegel);

        ProfilStatusBesked = $"Profilen '{profil.Navn}' er indlæst.";
        _logger.Info($"Profil indlæst: '{profil.Navn}'.");
        PlanlaegOpdatering();
    }

    private static void KopierRegel(DeleteTextRule? kilde, DeleteTextRule maal)
    {
        maal.ErAktiveret = kilde?.ErAktiveret ?? false;
        maal.TekstDerSkalSlettes = kilde?.TekstDerSkalSlettes ?? string.Empty;
        maal.ForskelPaaStoreSmaaBogstaver = kilde?.ForskelPaaStoreSmaaBogstaver ?? false;
    }

    private static void KopierRegel(ReplaceTextRule? kilde, ReplaceTextRule maal)
    {
        maal.ErAktiveret = kilde?.ErAktiveret ?? false;
        maal.Find = kilde?.Find ?? string.Empty;
        maal.ErstatMed = kilde?.ErstatMed ?? string.Empty;
        maal.ForskelPaaStoreSmaaBogstaver = kilde?.ForskelPaaStoreSmaaBogstaver ?? false;
        maal.Omfang = kilde?.Omfang ?? ReplaceScope.AlleForekomster;
    }

    private static void KopierRegel(AddTextRule? kilde, AddTextRule maal)
    {
        maal.ErAktiveret = kilde?.ErAktiveret ?? false;
        maal.Tekst = kilde?.Tekst ?? string.Empty;
        maal.Placering = kilde?.Placering ?? AddTextPlacement.Slutning;
        maal.BestemtTekst = kilde?.BestemtTekst ?? string.Empty;
        maal.Tegnposition = kilde?.Tegnposition ?? 1;
    }

    private static void KopierRegel(RegexRenameRule? kilde, RegexRenameRule maal)
    {
        maal.ErAktiveret = kilde?.ErAktiveret ?? false;
        maal.Moenster = kilde?.Moenster ?? string.Empty;
        maal.Erstatning = kilde?.Erstatning ?? string.Empty;
        maal.ForskelPaaStoreSmaaBogstaver = kilde?.ForskelPaaStoreSmaaBogstaver ?? false;
        maal.KunFoersteMatch = kilde?.KunFoersteMatch ?? false;
        maal.Maal = kilde?.Maal ?? RegexTarget.NavnUdenFilendelse;
    }

    private static void KopierRegel(CaseChangeRule? kilde, CaseChangeRule maal)
    {
        maal.ErAktiveret = kilde?.ErAktiveret ?? false;
        maal.Tilstand = kilde?.Tilstand ?? CaseChangeMode.IngenAendring;
    }

    private static void KopierRegel(NumberingRule? kilde, NumberingRule maal)
    {
        maal.ErAktiveret = kilde?.ErAktiveret ?? false;
        maal.Startnummer = kilde?.Startnummer ?? 1;
        maal.Trin = kilde?.Trin ?? 1;
        maal.AntalCifre = kilde?.AntalCifre ?? 3;
        maal.Placering = kilde?.Placering ?? NumberingPlacement.Start;
        maal.TekstFoerNummer = kilde?.TekstFoerNummer ?? string.Empty;
        maal.TekstEfterNummer = kilde?.TekstEfterNummer ?? string.Empty;
    }

    private async Task OmdoebProfilAsync()
    {
        if (ValgtProfilNavn is null) return;

        var profil = await _profileService.HentProfilAsync(ValgtProfilNavn).ConfigureAwait(true);
        if (profil is null) return;

        var gammeltNavn = profil.Navn;
        profil.Navn = ProfilNavnInput.Trim();
        await _profileService.GemProfilAsync(profil).ConfigureAwait(true);
        await _profileService.SletProfilAsync(gammeltNavn).ConfigureAwait(true);
        await IndlaesProfilNavneAsync().ConfigureAwait(true);
        ValgtProfilNavn = profil.Navn;
        ProfilStatusBesked = $"Profilen '{gammeltNavn}' er omdøbt til '{profil.Navn}'.";
    }

    private async Task SletProfilAsync()
    {
        if (ValgtProfilNavn is null) return;

        await _profileService.SletProfilAsync(ValgtProfilNavn).ConfigureAwait(true);
        ProfilStatusBesked = $"Profilen '{ValgtProfilNavn}' er slettet.";
        ValgtProfilNavn = null;
        await IndlaesProfilNavneAsync().ConfigureAwait(true);
    }
}
