namespace Filnavnevaerktoej.Core.Services;

/// <summary>
/// Normaliserer brugerens filtypefilter-tekst til en liste af filendelser, der kan matches mod filnavne.
/// Understøtter blandede skrivemåder: "*.dwg", "dwg", "*.dwg;*.pdf", "dwg,pdf,ifc", "*.*".
/// </summary>
public static class FileFilterParser
{
    /// <summary>Returnerer en liste af normaliserede filendelser (med punktum, fx ".dwg"), eller en tom liste for "alle filer".</summary>
    public static IReadOnlyList<string> Parse(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return Array.Empty<string>();

        var dele = raw.Split(new[] { ';', ',', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var resultat = new List<string>();
        foreach (var del in dele)
        {
            var normaliseret = NormaliserEtFilter(del);
            if (normaliseret is null)
                continue; // "*.*" eller "*" betyder alle filer

            if (!resultat.Contains(normaliseret, StringComparer.OrdinalIgnoreCase))
                resultat.Add(normaliseret);
        }

        return resultat;
    }

    /// <summary>Returnerer null hvis filteret betyder "alle filer".</summary>
    private static string? NormaliserEtFilter(string del)
    {
        var t = del.Trim();
        if (t is "*.*" or "*" or "")
            return null;

        if (t.StartsWith("*.", StringComparison.Ordinal))
            t = t[2..];
        else if (t.StartsWith('*'))
            t = t[1..];
        else if (t.StartsWith('.'))
            t = t[1..];

        return "." + t;
    }

    public static bool MatchesFilter(string fileName, IReadOnlyList<string> normaliseredeFiltre)
    {
        if (normaliseredeFiltre.Count == 0)
            return true;

        var ext = Path.GetExtension(fileName);
        foreach (var filter in normaliseredeFiltre)
        {
            if (string.Equals(ext, filter, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }
}
