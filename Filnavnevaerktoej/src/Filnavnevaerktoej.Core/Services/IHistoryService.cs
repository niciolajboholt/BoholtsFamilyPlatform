using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Services;

public interface IHistoryService
{
    Task GemAsync(RenameOperation operation, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RenameOperation>> HentAlleAsync(CancellationToken cancellationToken = default);
    Task<RenameOperation?> HentAsync(string operationId, CancellationToken cancellationToken = default);
}
