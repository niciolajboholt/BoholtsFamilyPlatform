namespace Filnavnevaerktoej.Core.Services;

/// <summary>Statisk hjælper til at validere filnavne mod Windows' regler, uafhængigt af det faktiske filsystem.</summary>
public static class WindowsFileNameValidator
{
    private static readonly char[] UgyldigeTegn = BygUgyldigeTegn();

    private static char[] BygUgyldigeTegn()
    {
        // Windows-reserverede tegn plus kontroltegn 0-31 (fx tab og linjeskift), som heller ikke er tilladt i filnavne.
        var eksplicitte = new[] { '<', '>', ':', '"', '/', '\\', '|', '?', '*' };
        var kontrolTegn = Enumerable.Range(0, 32).Select(i => (char)i);
        return eksplicitte.Concat(kontrolTegn).ToArray();
    }

    private static readonly HashSet<string> ReserveredeNavne = new(StringComparer.OrdinalIgnoreCase)
    {
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    };

    public const int MaksimalStiLaengde = 259;

    public static IReadOnlyList<char> UngyldigeTegnListe => UgyldigeTegn;

    /// <summary>Validerer et enkelt filnavn (uden mappesti). Returnerer en dansk fejlbesked, eller null hvis navnet er gyldigt.</summary>
    public static string? ValiderFilnavn(string filnavn)
    {
        if (string.IsNullOrEmpty(filnavn))
            return "Filnavnet må ikke være tomt.";

        if (filnavn.IndexOfAny(UgyldigeTegn) >= 0)
            return "Filnavnet indeholder tegn, der ikke er tilladt i Windows (fx < > : \" / \\ | ? *).";

        if (filnavn.EndsWith('.'))
            return "Filnavnet må ikke slutte med et punktum.";

        if (filnavn.EndsWith(' '))
            return "Filnavnet må ikke slutte med et mellemrum.";

        var navnUdenEndelse = Path.GetFileNameWithoutExtension(filnavn);
        if (ReserveredeNavne.Contains(navnUdenEndelse))
            return $"'{navnUdenEndelse}' er et reserveret Windows-navn og kan ikke bruges.";

        return null;
    }

    public static string? ValiderStiLaengde(string fuldSti)
    {
        return fuldSti.Length > MaksimalStiLaengde
            ? $"Stien er for lang ({fuldSti.Length} tegn). Windows understøtter som udgangspunkt højst {MaksimalStiLaengde} tegn."
            : null;
    }
}
