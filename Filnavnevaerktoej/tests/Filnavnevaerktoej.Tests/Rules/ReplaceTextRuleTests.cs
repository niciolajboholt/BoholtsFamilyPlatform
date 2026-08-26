using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Rules;
using Xunit;

namespace Filnavnevaerktoej.Tests.Rules;

public class ReplaceTextRuleTests
{
    private static RenameRuleContext Kontekst() => new() { OriginalFileName = "x", OriginalExtension = "", Index = 0 };

    [Fact]
    public void Anvend_ErstatAlleForekomster()
    {
        var regel = new ReplaceTextRule { ErAktiveret = true, Find = "a", ErstatMed = "_", Omfang = ReplaceScope.AlleForekomster };

        var resultat = regel.Anvend(new WorkingFileName("banana", ""), Kontekst());

        Assert.Equal("b_n_n_", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_ErstatKunFoersteForekomst()
    {
        var regel = new ReplaceTextRule { ErAktiveret = true, Find = "a", ErstatMed = "_", Omfang = ReplaceScope.FoersteForekomst };

        var resultat = regel.Anvend(new WorkingFileName("banana", ""), Kontekst());

        Assert.Equal("b_nana", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_ErstatKunSidsteForekomst()
    {
        var regel = new ReplaceTextRule { ErAktiveret = true, Find = "a", ErstatMed = "_", Omfang = ReplaceScope.SidsteForekomst };

        var resultat = regel.Anvend(new WorkingFileName("banana", ""), Kontekst());

        Assert.Equal("banan_", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_NiveauEksempelFraSpecifikationen()
    {
        var regel = new ReplaceTextRule { ErAktiveret = true, Find = "-Niveau0", ErstatMed = " - Niveau 0" };

        var resultat = regel.Anvend(new WorkingFileName("NB5_K01_H1_E0-Niveau0", ".dwg"), Kontekst());

        Assert.Equal("NB5_K01_H1_E0 - Niveau 0", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_ForskelPaaStoreSmaaBogstaver_FindesIkkeMedForkertStoerrelse()
    {
        var regel = new ReplaceTextRule
        {
            ErAktiveret = true,
            Find = "NIVEAU",
            ErstatMed = "Etage",
            ForskelPaaStoreSmaaBogstaver = true
        };

        var resultat = regel.Anvend(new WorkingFileName("Niveau0", ""), Kontekst());

        Assert.Equal("Niveau0", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_MedMellemrumITekst_ErstatterKorrekt()
    {
        var regel = new ReplaceTextRule { ErAktiveret = true, Find = "Kopi af ", ErstatMed = "" };

        var resultat = regel.Anvend(new WorkingFileName("Kopi af Tegning 01", ".dwg"), Kontekst());

        Assert.Equal("Tegning 01", resultat.NameWithoutExtension);
    }
}
