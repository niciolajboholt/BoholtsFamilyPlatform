using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Services;
using Filnavnevaerktoej.Tests.TestSupport;
using Xunit;

namespace Filnavnevaerktoej.Tests.Services;

public class FileDiscoveryServiceTests
{
    private readonly FileDiscoveryService _service = new();

    [Fact]
    public void ValiderMappe_MappeFindesIkke_GiverDanskFejlbesked()
    {
        var fejl = _service.ValiderMappe(Path.Combine(Path.GetTempPath(), "findes-ikke-" + Guid.NewGuid()));
        Assert.NotNull(fejl);
    }

    [Fact]
    public void ValiderMappe_TomSti_GiverFejl()
    {
        Assert.NotNull(_service.ValiderMappe(""));
        Assert.NotNull(_service.ValiderMappe(null));
    }

    [Fact]
    public void ValiderMappe_GyldigMappe_GiverIkkeFejl()
    {
        using var mappe = new TempTestFolder();
        Assert.Null(_service.ValiderMappe(mappe.Sti));
    }

    [Fact]
    public async Task FindFilerAsync_UdenUndermapper_FinderKunFilerITopMappen()
    {
        using var mappe = new TempTestFolder();
        mappe.OpretFil("a.dwg");
        mappe.OpretFil("b.dwg", "Undermappe");

        var resultat = await _service.FindFilerAsync(new FileDiscoveryOptions { MappeSti = mappe.Sti, MedtagUndermapper = false });

        Assert.Single(resultat);
        Assert.Equal("a.dwg", resultat[0].FileName);
    }

    [Fact]
    public async Task FindFilerAsync_MedUndermapper_FinderFilerIAlleUndermapper()
    {
        using var mappe = new TempTestFolder();
        mappe.OpretFil("a.dwg");
        mappe.OpretFil("b.dwg", "Undermappe");
        mappe.OpretFil("c.dwg", Path.Combine("Undermappe", "EndnuEnUndermappe"));

        var resultat = await _service.FindFilerAsync(new FileDiscoveryOptions { MappeSti = mappe.Sti, MedtagUndermapper = true });

        Assert.Equal(3, resultat.Count);
    }

    [Fact]
    public async Task FindFilerAsync_SkjulteFiler_MedtagesKunNaarIndstillingErSlaaetTil()
    {
        using var mappe = new TempTestFolder();
        mappe.OpretFil("synlig.txt");
        mappe.OpretFil(".skjult.txt");

        var udenSkjulte = await _service.FindFilerAsync(new FileDiscoveryOptions { MappeSti = mappe.Sti, MedtagSkjulteFiler = false });
        var medSkjulte = await _service.FindFilerAsync(new FileDiscoveryOptions { MappeSti = mappe.Sti, MedtagSkjulteFiler = true });

        Assert.Single(udenSkjulte);
        Assert.Equal(2, medSkjulte.Count);
    }

    [Fact]
    public async Task FindFilerAsync_FilterMedEenFiltype_FinderKunDenneType()
    {
        using var mappe = new TempTestFolder();
        mappe.OpretFil("a.dwg");
        mappe.OpretFil("b.pdf");

        var resultat = await _service.FindFilerAsync(new FileDiscoveryOptions { MappeSti = mappe.Sti, FilFilter = "*.dwg" });

        Assert.Single(resultat);
        Assert.Equal(".dwg", resultat[0].Extension);
    }

    [Fact]
    public async Task FindFilerAsync_ExcludererProgrammetsEgneUndoOgProfilFiler()
    {
        using var mappe = new TempTestFolder();
        mappe.OpretFil("rigtig-fil.txt");
        mappe.OpretFil("intern.fnv-undo.json");
        mappe.OpretFil("intern.fnv-log");
        mappe.OpretFil("intern.fnv-profil.json");

        var resultat = await _service.FindFilerAsync(new FileDiscoveryOptions { MappeSti = mappe.Sti });

        Assert.Single(resultat);
        Assert.Equal("rigtig-fil.txt", resultat[0].FileName);
    }
}
