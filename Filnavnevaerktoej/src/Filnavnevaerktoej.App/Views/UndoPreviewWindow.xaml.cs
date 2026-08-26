using System.Windows;
using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.App.Views;

public partial class UndoPreviewWindow : Window
{
    public UndoPreviewWindow(IReadOnlyList<RenamePreviewItem> forhaandsvisning)
    {
        InitializeComponent();
        ForhaandsvisningGrid.ItemsSource = forhaandsvisning;
    }

    private void OnFortsaetClick(object sender, RoutedEventArgs e)
    {
        DialogResult = true;
    }

    private void OnAnnullerClick(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
    }
}
