using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Services;

public sealed class FileValidationService : IFileValidationService
{
    public void Valider(IReadOnlyList<RenamePreviewItem> items, bool ekstensionAendringTilladt, bool tjekLaasteFiler = false)
    {
        foreach (var gruppe in items.GroupBy(i => i.Mappe, StringComparer.OrdinalIgnoreCase))
        {
            ValiderMappe(gruppe.Key, gruppe.ToList(), ekstensionAendringTilladt, tjekLaasteFiler);
        }
    }

    private static void ValiderMappe(string mappe, List<RenamePreviewItem> items, bool ekstensionAendringTilladt, bool tjekLaasteFiler)
    {
        var kildeStier = new HashSet<string>(items.Select(i => i.GammelFuldSti), StringComparer.OrdinalIgnoreCase);

        HashSet<string> diskEntries;
        try
        {
            diskEntries = new HashSet<string>(Directory.EnumerateFileSystemEntries(mappe), StringComparer.OrdinalIgnoreCase);
        }
        catch (Exception)
        {
            diskEntries = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        var nyeNavneGrupper = items
            .Where(i => i.AendresRentFaktisk)
            .GroupBy(i => i.NyFuldSti, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);

        foreach (var item in items)
        {
            if (!item.AendresRentFaktisk)
            {
                item.Status = RenameStatus.Uaendret;
                item.Bemaerkning = string.Empty;
                continue;
            }

            var filnavnFejl = WindowsFileNameValidator.ValiderFilnavn(item.NytFilnavn);
            if (filnavnFejl is not null)
            {
                item.Status = RenameStatus.Fejl;
                item.Bemaerkning = filnavnFejl;
                continue;
            }

            var stiFejl = WindowsFileNameValidator.ValiderStiLaengde(item.NyFuldSti);
            if (stiFejl is not null)
            {
                item.Status = RenameStatus.Fejl;
                item.Bemaerkning = stiFejl;
                continue;
            }

            if (nyeNavneGrupper.TryGetValue(item.NyFuldSti, out var dubletter) && dubletter.Count > 1)
            {
                item.Status = RenameStatus.Fejl;
                item.Bemaerkning = "Flere filer får samme nye navn i denne mappe.";
                continue;
            }

            var kolliderer = diskEntries.Contains(item.NyFuldSti)
                && !string.Equals(item.NyFuldSti, item.GammelFuldSti, StringComparison.OrdinalIgnoreCase)
                && !kildeStier.Contains(item.NyFuldSti);

            if (kolliderer)
            {
                item.Status = RenameStatus.Fejl;
                item.Bemaerkning = "Der findes allerede en fil med dette navn i mappen.";
                continue;
            }

            if (!ekstensionAendringTilladt &&
                !string.Equals(Path.GetExtension(item.NytFilnavn), Path.GetExtension(item.GammeltFilnavn), StringComparison.OrdinalIgnoreCase))
            {
                // Bør normalt ikke ske, da motoren tvinger filendelsen til at være uændret, men vi validerer defensivt.
                item.Status = RenameStatus.Fejl;
                item.Bemaerkning = "Filendelsen ville blive ændret, men det er ikke tilladt.";
                continue;
            }

            if (tjekLaasteFiler && ErLaastEllerIBrug(item.GammelFuldSti))
            {
                item.Status = RenameStatus.Fejl;
                item.Bemaerkning = "Filen er låst eller i brug af et andet program.";
                continue;
            }

            if (item.Kilde.IsReadOnly)
            {
                item.Status = RenameStatus.Advarsel;
                item.Bemaerkning = "Filen er skrivebeskyttet. Omdøbning forsøges alligevel.";
                continue;
            }

            if (ekstensionAendringTilladt &&
                !string.Equals(Path.GetExtension(item.NytFilnavn), Path.GetExtension(item.GammeltFilnavn), StringComparison.OrdinalIgnoreCase))
            {
                item.Status = RenameStatus.Advarsel;
                item.Bemaerkning = "Filendelsen ændres.";
                continue;
            }

            item.Status = RenameStatus.AendresGyldigt;
            item.Bemaerkning = string.Empty;
        }
    }

    private static bool ErLaastEllerIBrug(string fuldSti)
    {
        try
        {
            using var stream = File.Open(fuldSti, FileMode.Open, FileAccess.Read, FileShare.Read);
            return false;
        }
        catch (IOException)
        {
            return true;
        }
        catch (UnauthorizedAccessException)
        {
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }
}
