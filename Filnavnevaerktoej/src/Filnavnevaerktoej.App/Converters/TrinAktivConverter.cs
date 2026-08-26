using System.Globalization;
using System.Windows;
using System.Windows.Data;
using System.Windows.Media;
using Filnavnevaerktoej.App.ViewModels;

namespace Filnavnevaerktoej.App.Converters;

/// <summary>Returnerer en fremhævet blå farve hvis det aktuelle wizard-trin matcher parameteren, ellers grå.</summary>
public sealed class TrinAktivTilFarveConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is WizardStep current && parameter is string stepNavn && Enum.TryParse<WizardStep>(stepNavn, out var parsed))
            return current == parsed ? new SolidColorBrush(Color.FromRgb(0x00, 0x63, 0xB1)) : new SolidColorBrush(Color.FromRgb(0x8A, 0x8A, 0x8A));

        return new SolidColorBrush(Color.FromRgb(0x8A, 0x8A, 0x8A));
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public sealed class TrinAktivTilVaegtConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is WizardStep current && parameter is string stepNavn && Enum.TryParse<WizardStep>(stepNavn, out var parsed))
            return current == parsed ? FontWeights.SemiBold : FontWeights.Normal;

        return FontWeights.Normal;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
