using System.Text.Json;
using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Services;

public sealed class ProfileService : IProfileService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private readonly string _profilMappe;

    public ProfileService(string? profilMappe = null)
    {
        _profilMappe = profilMappe ?? AppPaths.ProfilMappe;
        Directory.CreateDirectory(_profilMappe);
    }

    private string StiTilFilnavn(string navn)
    {
        var ugyldige = Path.GetInvalidFileNameChars();
        var saneret = new string(navn.Select(c => ugyldige.Contains(c) ? '_' : c).ToArray());
        return Path.Combine(_profilMappe, $"{saneret}.fnv-profil.json");
    }

    public async Task GemProfilAsync(RenameProfile profil, CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(_profilMappe);
        profil.SidstAendretUtc = DateTime.UtcNow;
        var json = JsonSerializer.Serialize(profil, JsonOptions);
        await File.WriteAllTextAsync(StiTilFilnavn(profil.Navn), json, cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<RenameProfile>> HentAlleProfilerAsync(CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(_profilMappe))
            return Array.Empty<RenameProfile>();

        var resultat = new List<RenameProfile>();
        foreach (var fil in Directory.EnumerateFiles(_profilMappe, "*.fnv-profil.json"))
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                var json = await File.ReadAllTextAsync(fil, cancellationToken).ConfigureAwait(false);
                var profil = JsonSerializer.Deserialize<RenameProfile>(json, JsonOptions);
                if (profil is not null)
                    resultat.Add(profil);
            }
            catch (Exception)
            {
                // Beskadigede profilfiler springes over.
            }
        }

        return resultat.OrderBy(p => p.Navn, StringComparer.OrdinalIgnoreCase).ToList();
    }

    public async Task<RenameProfile?> HentProfilAsync(string navn, CancellationToken cancellationToken = default)
    {
        var sti = StiTilFilnavn(navn);
        if (!File.Exists(sti))
            return null;

        var json = await File.ReadAllTextAsync(sti, cancellationToken).ConfigureAwait(false);
        return JsonSerializer.Deserialize<RenameProfile>(json, JsonOptions);
    }

    public Task SletProfilAsync(string navn, CancellationToken cancellationToken = default)
    {
        var sti = StiTilFilnavn(navn);
        if (File.Exists(sti))
            File.Delete(sti);
        return Task.CompletedTask;
    }
}
