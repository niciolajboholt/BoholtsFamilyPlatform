using System.Globalization;
using System.Text;
using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Rules;

/// <summary>Ændrer store/små bogstaver i filnavnet (uden filendelse).</summary>
public sealed class CaseChangeRule : RenameRuleBase
{
    private CaseChangeMode _tilstand = CaseChangeMode.IngenAendring;

    public override string Navn => "Store/små bogstaver";

    public CaseChangeMode Tilstand
    {
        get => _tilstand;
        set => SetField(ref _tilstand, value);
    }

    public override WorkingFileName Anvend(WorkingFileName input, RenameRuleContext context)
    {
        if (!ErAktiveret || Tilstand == CaseChangeMode.IngenAendring)
            return input;

        var kultur = CultureInfo.InvariantCulture;
        var navn = input.NameWithoutExtension;

        var nytNavn = Tilstand switch
        {
            CaseChangeMode.SmaaBogstaver => navn.ToLower(kultur),
            CaseChangeMode.StoreBogstaver => navn.ToUpper(kultur),
            CaseChangeMode.FoersteBogstavStort => FoersteBogstavStort(navn, kultur),
            CaseChangeMode.TitelFormat => TitelFormat(navn, kultur),
            _ => navn
        };

        return input with { NameWithoutExtension = nytNavn };
    }

    private static string FoersteBogstavStort(string navn, CultureInfo kultur)
    {
        if (navn.Length == 0) return navn;
        return char.ToUpper(navn[0], kultur) + navn[1..].ToLower(kultur);
    }

    private static string TitelFormat(string navn, CultureInfo kultur)
    {
        if (navn.Length == 0) return navn;

        var resultat = new StringBuilder(navn.Length);
        var nyOrdStart = true;

        foreach (var tegn in navn)
        {
            if (char.IsLetterOrDigit(tegn))
            {
                resultat.Append(nyOrdStart ? char.ToUpper(tegn, kultur) : char.ToLower(tegn, kultur));
                nyOrdStart = false;
            }
            else
            {
                resultat.Append(tegn);
                nyOrdStart = true;
            }
        }

        return resultat.ToString();
    }
}
