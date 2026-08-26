using System.Collections.ObjectModel;
using System.Windows.Input;
using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.App.ViewModels;

/// <summary>Resultatside efter en gennemført (eller afbrudt) omdøbning.</summary>
public sealed class ResultViewModel : BaseViewModel
{
    private RenameOperation? _operation;
    private bool _kanFortryde;
    private string _statusOverskrift = string.Empty;

    public ObservableCollection<RenameOperationEntry> Fejl { get; } = new();

    public ICommand AabenMappeCommand { get; }
    public ICommand GemRapportCommand { get; }
    public ICommand FortrydCommand { get; }
    public ICommand StartForfraCommand { get; }
    public ICommand LukCommand { get; }

    public event EventHandler? AabenMappeAnmodet;
    public event EventHandler? GemRapportAnmodet;
    public event EventHandler? FortrydAnmodet;
    public event EventHandler? StartForfraAnmodet;
    public event EventHandler? LukAnmodet;

    public ResultViewModel()
    {
        AabenMappeCommand = new RelayCommand(() => AabenMappeAnmodet?.Invoke(this, EventArgs.Empty));
        GemRapportCommand = new RelayCommand(() => GemRapportAnmodet?.Invoke(this, EventArgs.Empty));
        FortrydCommand = new RelayCommand(() => FortrydAnmodet?.Invoke(this, EventArgs.Empty), () => KanFortryde);
        StartForfraCommand = new RelayCommand(() => StartForfraAnmodet?.Invoke(this, EventArgs.Empty));
        LukCommand = new RelayCommand(() => LukAnmodet?.Invoke(this, EventArgs.Empty));
    }

    public RenameOperation? Operation
    {
        get => _operation;
        private set => SetProperty(ref _operation, value);
    }

    public bool KanFortryde
    {
        get => _kanFortryde;
        set => SetProperty(ref _kanFortryde, value);
    }

    public string StatusOverskrift
    {
        get => _statusOverskrift;
        private set => SetProperty(ref _statusOverskrift, value);
    }

    public int AntalOmdoebt => Operation?.AntalOmdoebt ?? 0;
    public int AntalUaendret => Operation?.AntalSprungetOver ?? 0;
    public int AntalFejl => Operation?.AntalFejlet ?? 0;

    public void Opdater(RenameOperation operation, bool kanFortryde)
    {
        Operation = operation;
        KanFortryde = kanFortryde;

        Fejl.Clear();
        foreach (var entry in operation.Entries.Where(e => e.Resultat == RenameEntryResult.Fejlet))
            Fejl.Add(entry);

        StatusOverskrift = AntalFejl == 0
            ? "Omdøbningen blev gennemført uden fejl."
            : $"Omdøbningen blev gennemført med {AntalFejl} fejl.";

        OnPropertyChanged(nameof(AntalOmdoebt));
        OnPropertyChanged(nameof(AntalUaendret));
        OnPropertyChanged(nameof(AntalFejl));
    }
}
