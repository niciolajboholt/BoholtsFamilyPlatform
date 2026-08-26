using System.ComponentModel;
using System.Runtime.CompilerServices;
using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Rules;

/// <summary>Fælles basisimplementering med INotifyPropertyChanged, så regler kan bindes direkte i WPF.</summary>
public abstract class RenameRuleBase : IRenameRule
{
    private bool _erAktiveret = true;

    public bool ErAktiveret
    {
        get => _erAktiveret;
        set => SetField(ref _erAktiveret, value);
    }

    public abstract string Navn { get; }

    public abstract WorkingFileName Anvend(WorkingFileName input, RenameRuleContext context);

    public event PropertyChangedEventHandler? PropertyChanged;

    protected bool SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    protected void OnPropertyChanged([CallerMemberName] string? propertyName = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
