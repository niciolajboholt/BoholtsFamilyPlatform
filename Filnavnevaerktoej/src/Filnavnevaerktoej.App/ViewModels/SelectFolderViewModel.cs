using System.Collections.ObjectModel;
using System.Windows.Input;
using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Services;

namespace Filnavnevaerktoej.App.ViewModels;

/// <summary>Trin 1: valg af mappe, filter og undermapper/skjulte/system-indstillinger.</summary>
public sealed class SelectFolderViewModel : BaseViewModel
{
    private readonly IFileDiscoveryService _fileDiscovery;
    private readonly IAppLogger _logger;
    private readonly System.Timers.Timer _debounceTimer;
    private CancellationTokenSource? _scanCts;

    private string _mappeSti = string.Empty;
    private string _filFilter = "*.*";
    private bool _medtagUndermapper;
    private bool _medtagSkjulteFiler;
    private bool _medtagSystemfiler;
    private string? _mappeFejlBesked;
    private string _statusBesked = "Vælg en mappe for at komme i gang.";
    private bool _scannerNu;

    public SelectFolderViewModel(IFileDiscoveryService fileDiscovery, IAppLogger logger)
    {
        _fileDiscovery = fileDiscovery;
        _logger = logger;

        _debounceTimer = new System.Timers.Timer(350) { AutoReset = false };
        _debounceTimer.Elapsed += (_, _) => System.Windows.Application.Current?.Dispatcher.Invoke(TriggerScan);

        GennemseCommand = new RelayCommand(GennemseEfterMappe);
    }

    public ObservableCollection<FileItem> FundneFiler { get; } = new();

    public ICommand GennemseCommand { get; }

    public string MappeSti
    {
        get => _mappeSti;
        set
        {
            if (SetProperty(ref _mappeSti, value))
            {
                ValiderMappeSti();
                PlanlaegGenscanning();
            }
        }
    }

    public string FilFilter
    {
        get => _filFilter;
        set
        {
            if (SetProperty(ref _filFilter, value))
                PlanlaegGenscanning();
        }
    }

    public bool MedtagUndermapper
    {
        get => _medtagUndermapper;
        set
        {
            if (SetProperty(ref _medtagUndermapper, value))
                PlanlaegGenscanning();
        }
    }

    public bool MedtagSkjulteFiler
    {
        get => _medtagSkjulteFiler;
        set
        {
            if (SetProperty(ref _medtagSkjulteFiler, value))
                PlanlaegGenscanning();
        }
    }

    public bool MedtagSystemfiler
    {
        get => _medtagSystemfiler;
        set
        {
            if (SetProperty(ref _medtagSystemfiler, value))
                PlanlaegGenscanning();
        }
    }

    public string? MappeFejlBesked
    {
        get => _mappeFejlBesked;
        private set => SetProperty(ref _mappeFejlBesked, value);
    }

    public string StatusBesked
    {
        get => _statusBesked;
        private set => SetProperty(ref _statusBesked, value);
    }

    public bool ScannerNu
    {
        get => _scannerNu;
        private set => SetProperty(ref _scannerNu, value);
    }

    public bool ErMappeGyldig => MappeFejlBesked is null && !string.IsNullOrWhiteSpace(MappeSti);

    public bool KanGaaVidere => ErMappeGyldig && FundneFiler.Count > 0;

    public event EventHandler? TilstandAendret;

    private void ValiderMappeSti()
    {
        MappeFejlBesked = _fileDiscovery.ValiderMappe(MappeSti);
        OnPropertyChanged(nameof(ErMappeGyldig));
    }

    private void GennemseEfterMappe()
    {
        var valgtMappe = VisMappeDialog(MappeSti);
        if (valgtMappe is not null)
            MappeSti = valgtMappe;
    }

    /// <summary>Viser en rigtig Windows-mappevælger. Udskilt så den kan overstyres/testes uafhængigt af WPF.</summary>
    public Func<string, string?> VisMappeDialog { get; set; } = _ => null;

    private void PlanlaegGenscanning()
    {
        _debounceTimer.Stop();
        if (!ErMappeGyldig)
        {
            FundneFiler.Clear();
            StatusBesked = MappeFejlBesked ?? "Vælg en mappe for at komme i gang.";
            OnPropertyChanged(nameof(KanGaaVidere));
            TilstandAendret?.Invoke(this, EventArgs.Empty);
            return;
        }

        _debounceTimer.Start();
    }

    private async void TriggerScan()
    {
        await ScanAsync().ConfigureAwait(true);
    }

    public async Task ScanAsync()
    {
        if (!ErMappeGyldig)
            return;

        _scanCts?.Cancel();
        var cts = new CancellationTokenSource();
        _scanCts = cts;

        ScannerNu = true;
        try
        {
            var options = new FileDiscoveryOptions
            {
                MappeSti = MappeSti,
                FilFilter = FilFilter,
                MedtagUndermapper = MedtagUndermapper,
                MedtagSkjulteFiler = MedtagSkjulteFiler,
                MedtagSystemfiler = MedtagSystemfiler
            };

            var filer = await _fileDiscovery.FindFilerAsync(options, cts.Token).ConfigureAwait(true);
            if (cts.IsCancellationRequested)
                return;

            FundneFiler.Clear();
            foreach (var fil in filer)
                FundneFiler.Add(fil);

            StatusBesked = FundneFiler.Count switch
            {
                0 => "Der blev ikke fundet nogen filer, der matcher filteret.",
                1 => "Der er fundet 1 fil.",
                _ => $"Der er fundet {FundneFiler.Count} filer."
            };

            _logger.Info($"Scannede '{MappeSti}': {FundneFiler.Count} fil(er) fundet (filter='{FilFilter}', undermapper={MedtagUndermapper}).");
        }
        catch (OperationCanceledException)
        {
            // Forventet ved hurtige efterfølgende ændringer - ignoreres.
        }
        finally
        {
            if (!cts.IsCancellationRequested)
                ScannerNu = false;

            OnPropertyChanged(nameof(KanGaaVidere));
            TilstandAendret?.Invoke(this, EventArgs.Empty);
        }
    }
}
