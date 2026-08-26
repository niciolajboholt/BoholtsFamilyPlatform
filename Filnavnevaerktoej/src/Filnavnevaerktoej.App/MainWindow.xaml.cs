using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Windows;
using Filnavnevaerktoej.App.ViewModels;
using Filnavnevaerktoej.App.Views;
using Filnavnevaerktoej.Core.Models;
using Microsoft.Win32;

namespace Filnavnevaerktoej.App;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private WizardViewModel? ViewModel => DataContext as WizardViewModel;

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (ViewModel is null) return;

        ViewModel.VisMappeDialog = VisMappeDialog;
        ViewModel.VisGemRapportDialog = VisGemRapportDialog;
        ViewModel.VisFortrydForhaandsvisning = VisFortrydForhaandsvisning;
        ViewModel.VisBesked = VisBesked;
        ViewModel.AabenMappeAnmodet += (_, mappe) => AabenMappeIStifinder(mappe);
        ViewModel.AnnullerAnmodet += OnAnnullerAnmodet;
        ViewModel.LukAnmodet += (_, _) => Close();
    }

    private string? VisMappeDialog(string startSti)
    {
        var dialog = new OpenFolderDialog
        {
            Title = "Vælg mappe med filer, der skal omdøbes",
            Multiselect = false
        };

        if (!string.IsNullOrWhiteSpace(startSti) && Directory.Exists(startSti))
            dialog.InitialDirectory = startSti;

        return dialog.ShowDialog(this) == true ? dialog.FolderName : null;
    }

    private string? VisGemRapportDialog()
    {
        var dialog = new SaveFileDialog
        {
            Title = "Gem rapport",
            Filter = "CSV-fil (*.csv)|*.csv",
            FileName = $"Filnavnevaerktoej-rapport-{DateTime.Now:yyyy-MM-dd-HHmm}.csv"
        };

        return dialog.ShowDialog(this) == true ? dialog.FileName : null;
    }

    private bool VisFortrydForhaandsvisning(IReadOnlyList<RenamePreviewItem> forhaandsvisning)
    {
        var dialog = new UndoPreviewWindow(forhaandsvisning) { Owner = this };
        return dialog.ShowDialog() == true;
    }

    private void VisBesked(string besked, bool erFejl)
    {
        MessageBox.Show(this, besked, "Filnavneværktøj",
            MessageBoxButton.OK,
            erFejl ? MessageBoxImage.Warning : MessageBoxImage.Information);
    }

    private void AabenMappeIStifinder(string mappe)
    {
        if (string.IsNullOrWhiteSpace(mappe) || !Directory.Exists(mappe))
            return;

        try
        {
            Process.Start(new ProcessStartInfo("explorer.exe", $"\"{mappe}\"") { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, $"Mappen kunne ikke åbnes: {ex.Message}", "Filnavneværktøj", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void OnAnnullerAnmodet(object? sender, EventArgs e)
    {
        var svar = MessageBox.Show(this,
            "Er du sikker på, at du vil annullere? Ingen filer er blevet omdøbt endnu.",
            "Annuller",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question);

        if (svar == MessageBoxResult.Yes)
            Close();
    }

    private void OnAabenHistorikClick(object sender, RoutedEventArgs e)
    {
        if (ViewModel is null) return;

        var historikVindue = new HistoryWindow(ViewModel.HistoryViewModel) { Owner = this };
        historikVindue.ShowDialog();
    }

    private void OnAabenOmClick(object sender, RoutedEventArgs e)
    {
        var omVindue = new AboutWindow { Owner = this };
        omVindue.ShowDialog();
    }

    private void OnClosing(object? sender, CancelEventArgs e)
    {
        if (ViewModel?.ErOpsaetningIGang != true)
            return;

        var svar = MessageBox.Show(this,
            "Der er en igangværende opsætning, som ikke er gennemført. Er du sikker på, at du vil lukke programmet?",
            "Luk Filnavneværktøj",
            MessageBoxButton.YesNo,
            MessageBoxImage.Warning);

        if (svar != MessageBoxResult.Yes)
            e.Cancel = true;
    }
}
