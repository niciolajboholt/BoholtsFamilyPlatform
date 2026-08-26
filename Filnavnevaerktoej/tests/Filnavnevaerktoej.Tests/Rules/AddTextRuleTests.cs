using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Rules;
using Xunit;

namespace Filnavnevaerktoej.Tests.Rules;

public class AddTextRuleTests
{
    private static RenameRuleContext Kontekst() => new() { OriginalFileName = "x", OriginalExtension = "", Index = 0 };

    [Fact]
    public void Anvend_TilfoejIStarten()
    {
        var regel = new AddTextRule { ErAktiveret = true, Tekst = "NY_", Placering = AddTextPlacement.Start };

        var resultat = regel.Anvend(new WorkingFileName("Tegning01", ".dwg"), Kontekst());

        Assert.Equal("NY_Tegning01", resultat.NameWithoutExtension);
        Assert.Equal(".dwg", resultat.Extension);
    }

    [Fact]
    public void Anvend_TilfoejISlutningen()
    {
        var regel = new AddTextRule { ErAktiveret = true, Tekst = "_gammel", Placering = AddTextPlacement.Slutning };

        var resultat = regel.Anvend(new WorkingFileName("Tegning01", ".dwg"), Kontekst());

        Assert.Equal("Tegning01_gammel", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_TilfoejFoerBestemtTekst()
    {
        var regel = new AddTextRule
        {
            ErAktiveret = true,
            Tekst = "NY-",
            Placering = AddTextPlacement.FoerTekst,
            BestemtTekst = "Niveau"
        };

        var resultat = regel.Anvend(new WorkingFileName("Bygning-Niveau1", ""), Kontekst());

        Assert.Equal("Bygning-NY-Niveau1", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_TilfoejEfterBestemtTekst()
    {
        var regel = new AddTextRule
        {
            ErAktiveret = true,
            Tekst = "-NY",
            Placering = AddTextPlacement.EfterTekst,
            BestemtTekst = "Niveau"
        };

        var resultat = regel.Anvend(new WorkingFileName("Bygning-Niveau1", ""), Kontekst());

        Assert.Equal("Bygning-Niveau-NY1", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_TilfoejVedTegnposition_Position1ErFoerFoersteTegn()
    {
        var regel = new AddTextRule { ErAktiveret = true, Tekst = "X", Placering = AddTextPlacement.VedPosition, Tegnposition = 1 };

        var resultat = regel.Anvend(new WorkingFileName("ABC", ""), Kontekst());

        Assert.Equal("XABC", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_TilfoejVedTegnposition_MidtIStrengen()
    {
        var regel = new AddTextRule { ErAktiveret = true, Tekst = "-", Placering = AddTextPlacement.VedPosition, Tegnposition = 3 };

        var resultat = regel.Anvend(new WorkingFileName("ABCDEF", ""), Kontekst());

        Assert.Equal("AB-CDEF", resultat.NameWithoutExtension);
    }
}
