using System.Windows;

namespace Filnavnevaerktoej.App.Views;

public partial class FejlDialogWindow : Window
{
    private readonly string _tekniskeDetaljer;

    public FejlDialogWindow(Exception exception, string logMappe)
    {
        InitializeComponent();
        _tekniskeDetaljer = $"{exception.GetType().FullName}: {exception.Message}{Environment.NewLine}{exception.StackTrace}";
        DetaljerTekstboks.Text = _tekniskeDetaljer;
        LogStiTekst.Text = $"Der findes en detaljeret logfil her: {logMappe}";
    }

    private void OnKopierClick(object sender, RoutedEventArgs e)
    {
        try
        {
            Clipboard.SetText(_tekniskeDetaljer);
        }
        catch
        {
            // Udklipsholderen kan i sjældne tilfælde være optaget af et andet program - ignoreres bevidst.
        }
    }

    private void OnLukClick(object sender, RoutedEventArgs e) => Close();
}
