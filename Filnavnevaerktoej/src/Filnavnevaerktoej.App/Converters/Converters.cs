using System.Globalization;
using System.Windows;
using System.Windows.Data;
using System.Windows.Media;
using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.App.Converters;

public sealed class StatusTilBaggrundConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        return value switch
        {
            RenameStatus.AendresGyldigt => new SolidColorBrush(Color.FromRgb(0xE6, 0xF4, 0xEA)),
            RenameStatus.Fejl => new SolidColorBrush(Color.FromRgb(0xFC, 0xE8, 0xE8)),
            RenameStatus.Advarsel => new SolidColorBrush(Color.FromRgb(0xFF, 0xF6, 0xDC)),
            RenameStatus.Uaendret => new SolidColorBrush(Color.FromRgb(0xF2, 0xF2, 0xF2)),
            _ => Brushes.Transparent
        };
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public sealed class StatusTilTekstConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        return value switch
        {
            RenameStatus.AendresGyldigt => "Ændres",
            RenameStatus.Fejl => "Fejl",
            RenameStatus.Advarsel => "Advarsel",
            RenameStatus.Uaendret => "Uændret",
            _ => string.Empty
        };
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public sealed class OperationStatusTilTekstConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        return value switch
        {
            OperationStatus.GennemfoertUdenFejl => "Gennemført uden fejl",
            OperationStatus.GennemfoertMedFejl => "Gennemført med fejl",
            OperationStatus.Fortrudt => "Fortrudt",
            OperationStatus.Afbrudt => "Afbrudt",
            _ => string.Empty
        };
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public sealed class FilstoerrelseConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is not long bytes) return string.Empty;

        var dansk = CultureInfo.GetCultureInfo("da-DK");
        string[] enheder = { "byte", "KB", "MB", "GB", "TB" };
        double stoerrelse = bytes;
        var enhedIndex = 0;

        while (stoerrelse >= 1024 && enhedIndex < enheder.Length - 1)
        {
            stoerrelse /= 1024;
            enhedIndex++;
        }

        var format = enhedIndex == 0 ? "N0" : "N1";
        return $"{stoerrelse.ToString(format, dansk)} {enheder[enhedIndex]}";
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public sealed class InverterBoolConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value is bool b && !b;

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        value is bool b && !b;
}

public sealed class BoolTilSynlighedConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var vis = value is bool b && b;
        if (string.Equals(parameter as string, "Inverter", StringComparison.OrdinalIgnoreCase))
            vis = !vis;
        return vis ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        value is Visibility v && v == Visibility.Visible;
}

public sealed class StringIkkeTomTilSynlighedConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        string.IsNullOrEmpty(value as string) ? Visibility.Collapsed : Visibility.Visible;

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public sealed class TilfoejKraeverBestemtTekstConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var kraeves = value is AddTextPlacement p && p is AddTextPlacement.FoerTekst or AddTextPlacement.EfterTekst;
        return kraeves ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public sealed class TilfoejKraeverPositionConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value is AddTextPlacement.VedPosition ? Visibility.Visible : Visibility.Collapsed;

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public sealed class EnumLighedConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value?.Equals(parameter) ?? false;

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        value is bool b && b ? parameter : Binding.DoNothing;
}
