namespace Filnavnevaerktoej.Tests.TestSupport;

/// <summary>
/// Opretter en midlertidig, unik testmappe og rydder den op igen ved Dispose.
/// Bruges af alle tests, der skal røre det virkelige filsystem, så brugerens rigtige filer aldrig påvirkes.
/// </summary>
public sealed class TempTestFolder : IDisposable
{
    public string Sti { get; }

    public TempTestFolder()
    {
        Sti = Path.Combine(Path.GetTempPath(), "FilnavnevaerktoejTests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Sti);
    }

    /// <summary>Opretter en tom testfil med det angivne navn i testmappen (eller en angivet undermappe).</summary>
    public string OpretFil(string filnavn, string? undermappe = null)
    {
        var mappe = undermappe is null ? Sti : Path.Combine(Sti, undermappe);
        Directory.CreateDirectory(mappe);
        var fuldSti = Path.Combine(mappe, filnavn);
        File.WriteAllText(fuldSti, string.Empty);
        return fuldSti;
    }

    public string OpretUndermappe(string navn)
    {
        var mappe = Path.Combine(Sti, navn);
        Directory.CreateDirectory(mappe);
        return mappe;
    }

    public void Dispose()
    {
        try
        {
            if (Directory.Exists(Sti))
                Directory.Delete(Sti, recursive: true);
        }
        catch
        {
            // Testoprydning må aldrig lade en test fejle pga. et efterladt filhåndtag.
        }
    }
}
