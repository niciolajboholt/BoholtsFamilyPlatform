using System.Collections.ObjectModel;
using System.Windows.Input;
using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Services;

namespace Filnavnevaerktoej.App.ViewModels;

public sealed class HistoryRow
{
    public required RenameOperation Operation { get; init; }
    public DateTime Dato => Operation.TidspunktUtc.ToLocalTime();
    public string Mappe => Operation.KildeMappe;
    public int AntalFiler => Operation.Entries.Count;
    public OperationStatus Status => Operation.BeregnStatus();
    public bool KanFortrydes => !Operation.ErFortrudt && Operation.Entries.Any(e => e.Resultat == RenameEntryResult.Succes);
}

/// <summary>Viser historik over tidligere omdøbningsoperationer, med mulighed for at se detaljer og fortryde.</summary>
public sealed class HistoryViewModel : BaseViewModel
{
    private readonly IHistoryService _historyService;
    private HistoryRow? _valgtOperation;

    public HistoryViewModel(IHistoryService historyService)
    {
        _historyService = historyService;
        OpdaterCommand = new AsyncRelayCommand(IndlaesAsync);
        FortrydCommand = new RelayCommand(() =>
        {
            if (ValgtOperation is not null)
                FortrydAnmodet?.Invoke(this, ValgtOperation.Operation);
        }, () => ValgtOperation?.KanFortrydes ?? false);
    }

    public ObservableCollection<HistoryRow> Operationer { get; } = new();

    public HistoryRow? ValgtOperation
    {
        get => _valgtOperation;
        set => SetProperty(ref _valgtOperation, value);
    }

    public ICommand OpdaterCommand { get; }
    public ICommand FortrydCommand { get; }

    public event EventHandler<RenameOperation>? FortrydAnmodet;

    public async Task IndlaesAsync()
    {
        var operationer = await _historyService.HentAlleAsync().ConfigureAwait(true);
        Operationer.Clear();
        foreach (var operation in operationer)
            Operationer.Add(new HistoryRow { Operation = operation });
    }
}
