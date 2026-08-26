using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Rules;
using Xunit;

namespace Filnavnevaerktoej.Tests.Rules;

public class DeleteTextRuleTests
{
    private static RenameRuleContext Kontekst(string filnavn, string extension) =>
        new() { OriginalFileName = filnavn, OriginalExtension = extension, Index = 0 };

    [Fact]
    public void Anvend_SletterAlleForekomsterAfTekst()
    {
        var regel = new DeleteTextRule { ErAktiveret = true, TekstDerSkalSlettes = "FloorPlan-" };
        var input = new WorkingFileName("FloorPlan-NB5_K01_H1_E0-Niveau0", ".dwg");

        var resultat = regel.Anvend(input, Kontekst("FloorPlan-NB5_K01_H1_E0-Niveau0.dwg", ".dwg"));

        Assert.Equal("NB5_K01_H1_E0-Niveau0", resultat.NameWithoutExtension);
        Assert.Equal(".dwg", resultat.Extension);
    }

    [Fact]
    public void Anvend_PaavirkerAldrigFilendelsen()
    {
        var regel = new DeleteTextRule { ErAktiveret = true, TekstDerSkalSlettes = "dwg" };
        var input = new WorkingFileName("MinTegning", ".dwg");

        var resultat = regel.Anvend(input, Kontekst("MinTegning.dwg", ".dwg"));

        Assert.Equal(".dwg", resultat.Extension);
        Assert.Equal("MinTegning", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_ForskelPaaStoreSmaaBogstaver_SkelnerMellemStortOgLille()
    {
        var regel = new DeleteTextRule
        {
            ErAktiveret = true,
            TekstDerSkalSlettes = "plan",
            ForskelPaaStoreSmaaBogstaver = true
        };

        var resultat = regel.Anvend(new WorkingFileName("FloorPlan", ""), Kontekst("FloorPlan", ""));

        // "plan" (småt) matcher ikke "Plan" (stort P) når der skelnes mellem store/små bogstaver.
        Assert.Equal("FloorPlan", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_UdenForskelPaaStoreSmaa_MatcherUansetStoerrelse()
    {
        var regel = new DeleteTextRule
        {
            ErAktiveret = true,
            TekstDerSkalSlettes = "plan",
            ForskelPaaStoreSmaaBogstaver = false
        };

        var resultat = regel.Anvend(new WorkingFileName("FloorPlan", ""), Kontekst("FloorPlan", ""));

        Assert.Equal("Floor", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_DeaktiveretRegel_AendrerIkkeNavnet()
    {
        var regel = new DeleteTextRule { ErAktiveret = false, TekstDerSkalSlettes = "Floor" };
        var input = new WorkingFileName("FloorPlan", ".dwg");

        var resultat = regel.Anvend(input, Kontekst("FloorPlan.dwg", ".dwg"));

        Assert.Equal(input, resultat);
    }

    [Fact]
    public void Anvend_MedDanskeTegn_BevarerAeOgOogAa()
    {
        var regel = new DeleteTextRule { ErAktiveret = true, TekstDerSkalSlettes = "gammel-" };
        var input = new WorkingFileName("gammel-Ærø_Ødensé_Aabenraa", ".pdf");

        var resultat = regel.Anvend(input, Kontekst("gammel-Ærø_Ødensé_Aabenraa.pdf", ".pdf"));

        Assert.Equal("Ærø_Ødensé_Aabenraa", resultat.NameWithoutExtension);
    }
}
