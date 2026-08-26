using System.Windows;
using Filnavnevaerktoej.App.ViewModels;

namespace Filnavnevaerktoej.App.Views;

public partial class HistoryWindow : Window
{
    public HistoryWindow(HistoryViewModel viewModel)
    {
        InitializeComponent();
        DataContext = viewModel;
        Loaded += async (_, _) => await viewModel.IndlaesAsync();
    }

    private void OnLukClick(object sender, RoutedEventArgs e) => Close();
}
