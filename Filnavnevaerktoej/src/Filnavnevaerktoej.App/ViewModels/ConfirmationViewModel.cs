using System.Collections.ObjectModel;
using System.Windows.Input;
using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.App.ViewModels;

public sealed class ConfirmationRow
{
    public required int Nr { get; init; }
    public required string GammeltFilnavn { get; init; }
    public required string NytFilnavn { get; init; }
    public required string Mappe { get; init; }
    public required RenameStatus Status { get; init; }
}

/// <summary>Trin 3: bekræftelse før den faktiske omdøbning udføres.</summary>
public sealed class ConfirmationViewModel : BaseViewModel
{
    private bool _harKontrolleret;
    private bool _udfoererNu;
    private double _fremdriftProcent;
    private string _fremdriftBesked = string.Empty;

    public ObservableCollection<ConfirmationRow> Raekker { get; } = new();

    public ICommand TilbageCommand { get; }
    public ICommand AnnullerCommand { get; }
    public ICommand OmdoebCommand { get; }

    public event EventHandler? TilbageAnmodet;
    public event EventHandler? AnnullerAnmodet;
    public event EventHandler? OmdoebGodkendt;

    public ConfirmationViewModel()
    {
        TilbageCommand = new RelayCommand(() => TilbageAnmodet?.Invoke(this, EventArgs.Empty), () => !UdfoererNu);
        AnnullerCommand = new RelayCommand(() => AnnullerAnmodet?.Invoke(this, EventArgs.Empty), () => !UdfoererNu);
        OmdoebCommand = new RelayCommand(() => OmdoebGodkendt?.Invoke(this, EventArgs.Empty), () => HarKontrolleret && !UdfoererNu && Raekker.Count > 0);
    }

    public bool HarKontrolleret
    {
        get => _harKontrolleret;
        set => SetProperty(ref _harKontrolleret, value);
    }

    public bool UdfoererNu
    {
        get => _udfoererNu;
        set => SetProperty(ref _udfoererNu, value);
    }

    public double FremdriftProcent
    {
        get => _fremdriftProcent;
        set => SetProperty(ref _fremdriftProcent, value);
    }

    public string FremdriftBesked
    {
        get => _fremdriftBesked;
        set => SetProperty(ref _fremdriftBesked, value);
    }

    public int AntalDerOmdoebes => Raekker.Count;

    public void Opdater(IReadOnlyList<RenamePreviewItem> aendredeElementer)
    {
        Raekker.Clear();
        var nr = 1;
        foreach (var item in aendredeElementer)
        {
            Raekker.Add(new ConfirmationRow
            {
                Nr = nr++,
                GammeltFilnavn = item.GammeltFilnavn,
                NytFilnavn = item.NytFilnavn,
                Mappe = item.Mappe,
                Status = item.Status
            });
        }

        HarKontrolleret = false;
        OnPropertyChanged(nameof(AntalDerOmdoebes));
    }
}
