using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Rules;
using Xunit;

namespace Filnavnevaerktoej.Tests.Rules;

public class CaseChangeRuleTests
{
    private static RenameRuleContext Kontekst() => new() { OriginalFileName = "x", OriginalExtension = "", Index = 0 };

    [Fact]
    public void Anvend_SmaaBogstaver()
    {
        var regel = new CaseChangeRule { ErAktiveret = true, Tilstand = CaseChangeMode.SmaaBogstaver };
        var resultat = regel.Anvend(new WorkingFileName("Tegning ÅRHUS", ".DWG"), Kontekst());

        Assert.Equal("tegning århus", resultat.NameWithoutExtension);
        Assert.Equal(".DWG", resultat.Extension);
    }

    [Fact]
    public void Anvend_StoreBogstaver()
    {
        var regel = new CaseChangeRule { ErAktiveret = true, Tilstand = CaseChangeMode.StoreBogstaver };
        var resultat = regel.Anvend(new WorkingFileName("tegning", ""), Kontekst());

        Assert.Equal("TEGNING", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_FoersteBogstavStort()
    {
        var regel = new CaseChangeRule { ErAktiveret = true, Tilstand = CaseChangeMode.FoersteBogstavStort };
        var resultat = regel.Anvend(new WorkingFileName("hello world", ""), Kontekst());

        Assert.Equal("Hello world", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_TitelFormat()
    {
        var regel = new CaseChangeRule { ErAktiveret = true, Tilstand = CaseChangeMode.TitelFormat };
        var resultat = regel.Anvend(new WorkingFileName("floor plan_niveau-0", ""), Kontekst());

        Assert.Equal("Floor Plan_Niveau-0", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_IngenAendring_LaderNavnetVaereUberoert()
    {
        var regel = new CaseChangeRule { ErAktiveret = true, Tilstand = CaseChangeMode.IngenAendring };
        var resultat = regel.Anvend(new WorkingFileName("Blandet Navn", ""), Kontekst());

        Assert.Equal("Blandet Navn", resultat.NameWithoutExtension);
    }
}
