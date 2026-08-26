using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Services;

public sealed class FileDiscoveryService : IFileDiscoveryService
{
    public string? ValiderMappe(string? mappeSti)
    {
        if (string.IsNullOrWhiteSpace(mappeSti))
            return "Angiv en mappe.";

        string fuldSti;
        try
        {
            fuldSti = Path.GetFullPath(mappeSti);
        }
        catch (Exception)
        {
            return "Mappestien er ugyldig.";
        }

        if (!Directory.Exists(fuldSti))
            return "Den angivne mappe findes ikke.";

        try
        {
            // Prøv at læse mappens indhold for at afdække manglende adgang tidligt.
            _ = Directory.EnumerateFileSystemEntries(fuldSti).Take(1).ToList();
        }
        catch (UnauthorizedAccessException)
        {
            return "Du har ikke adgang til den valgte mappe.";
        }
        catch (IOException)
        {
            return "Mappen kunne ikke læses.";
        }

        return null;
    }

    public Task<IReadOnlyList<FileItem>> FindFilerAsync(FileDiscoveryOptions options, CancellationToken cancellationToken = default)
    {
        return Task.Run(() => FindFiler(options, cancellationToken), cancellationToken);
    }

    private static IReadOnlyList<FileItem> FindFiler(FileDiscoveryOptions options, CancellationToken cancellationToken)
    {
        var mappeSti = Path.GetFullPath(options.MappeSti);
        var filtre = FileFilterParser.Parse(options.FilFilter);
        var soegeOption = options.MedtagUndermapper ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;

        var eksekverendeFil = TryGetEksekverendeFil();
        var beskyttedeMapper = new[] { AppPaths.RodMappe };

        var resultat = new List<FileItem>();

        IEnumerable<string> filer;
        try
        {
            filer = Directory.EnumerateFiles(mappeSti, "*", soegeOption);
        }
        catch (UnauthorizedAccessException)
        {
            return resultat;
        }

        foreach (var fil in filer)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (eksekverendeFil is not null && string.Equals(fil, eksekverendeFil, StringComparison.OrdinalIgnoreCase))
                continue;

            if (AppPaths.BeskyttedeFilendelser.Any(e => fil.EndsWith(e, StringComparison.OrdinalIgnoreCase)))
                continue;

            if (beskyttedeMapper.Any(b => fil.StartsWith(b, StringComparison.OrdinalIgnoreCase)))
                continue;

            FileInfo info;
            try
            {
                info = new FileInfo(fil);
            }
            catch (Exception)
            {
                continue;
            }

            if (!info.Exists)
                continue;

            var erSkjult = info.Attributes.HasFlag(FileAttributes.Hidden);
            var erSystem = info.Attributes.HasFlag(FileAttributes.System);

            if (erSkjult && !options.MedtagSkjulteFiler)
                continue;

            if (erSystem && !options.MedtagSystemfiler)
                continue;

            if (!FileFilterParser.MatchesFilter(info.Name, filtre))
                continue;

            resultat.Add(new FileItem
            {
                FullPath = info.FullName,
                FileName = info.Name,
                Extension = info.Extension,
                DirectoryPath = info.DirectoryName ?? mappeSti,
                SizeBytes = info.Length,
                LastModifiedUtc = info.LastWriteTimeUtc,
                IsHidden = erSkjult,
                IsSystem = erSystem,
                IsReadOnly = info.IsReadOnly
            });
        }

        return resultat
            .OrderBy(f => f.DirectoryPath, StringComparer.OrdinalIgnoreCase)
            .ThenBy(f => f.FileName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string? TryGetEksekverendeFil()
    {
        try
        {
            return Environment.ProcessPath is { Length: > 0 } sti ? Path.GetFullPath(sti) : null;
        }
        catch
        {
            return null;
        }
    }
}
