using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Services;

public interface IReportService
{
    Task GemCsvRapportAsync(RenameOperation operation, string filSti, CancellationToken cancellationToken = default);
}
