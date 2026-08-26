using System.Windows;
using Filnavnevaerktoej.Core.Services;

namespace Filnavnevaerktoej.App.Views;

public partial class AboutWindow : Window
{
    public AboutWindow()
    {
        InitializeComponent();
        VersionTekst.Text = $"Version {App.ProgramVersion}";
        LogStiTekst.Text = $"Logfiler: {AppPaths.LogMappe}";
        HistorikStiTekst.Text = $"Historik/undo: {AppPaths.HistorikMappe}";
        ProfilStiTekst.Text = $"Profiler: {AppPaths.ProfilMappe}";
    }

    private void OnLukClick(object sender, RoutedEventArgs e) => Close();
}
