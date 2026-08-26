using System.Text.Json;
using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Services;

public sealed class HistoryService : IHistoryService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private readonly string _historikMappe;

    public HistoryService(string? historikMappe = null)
    {
        _historikMappe = historikMappe ?? AppPaths.HistorikMappe;
        Directory.CreateDirectory(_historikMappe);
    }

    private string StiTil(string operationId) => Path.Combine(_historikMappe, $"{operationId}.fnv-undo.json");

    public async Task GemAsync(RenameOperation operation, CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(_historikMappe);
        var json = JsonSerializer.Serialize(operation, JsonOptions);
        await File.WriteAllTextAsync(StiTil(operation.OperationId), json, cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<RenameOperation>> HentAlleAsync(CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(_historikMappe))
            return Array.Empty<RenameOperation>();

        var resultat = new List<RenameOperation>();
        foreach (var fil in Directory.EnumerateFiles(_historikMappe, "*.fnv-undo.json"))
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                var json = await File.ReadAllTextAsync(fil, cancellationToken).ConfigureAwait(false);
                var operation = JsonSerializer.Deserialize<RenameOperation>(json, JsonOptions);
                if (operation is not null)
                    resultat.Add(operation);
            }
            catch (Exception)
            {
                // Beskadigede historikfiler springes over, resten af historikken skal stadig kunne vises.
            }
        }

        return resultat.OrderByDescending(o => o.TidspunktUtc).ToList();
    }

    public async Task<RenameOperation?> HentAsync(string operationId, CancellationToken cancellationToken = default)
    {
        var sti = StiTil(operationId);
        if (!File.Exists(sti))
            return null;

        var json = await File.ReadAllTextAsync(sti, cancellationToken).ConfigureAwait(false);
        return JsonSerializer.Deserialize<RenameOperation>(json, JsonOptions);
    }
}
