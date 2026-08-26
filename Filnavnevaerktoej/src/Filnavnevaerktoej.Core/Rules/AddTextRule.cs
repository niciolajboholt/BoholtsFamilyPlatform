using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Rules;

/// <summary>
/// Tilføjer en tekst et bestemt sted i filnavnet (uden filendelse).
/// "I slutningen af filnavnet" og "Før filendelsen" giver samme resultat, da værktøjet altid
/// holder navn og filendelse adskilt og som udgangspunkt bevarer filendelsen uændret.
/// </summary>
public sealed class AddTextRule : RenameRuleBase
{
    private string _tekst = string.Empty;
    private AddTextPlacement _placering = AddTextPlacement.Slutning;
    private string _bestemtTekst = string.Empty;
    private int _tegnposition = 1;

    public override string Navn => "Tilføj tekst";

    public string Tekst
    {
        get => _tekst;
        set => SetField(ref _tekst, value ?? string.Empty);
    }

    public AddTextPlacement Placering
    {
        get => _placering;
        set => SetField(ref _placering, value);
    }

    /// <summary>Bruges når Placering er FoerTekst eller EfterTekst.</summary>
    public string BestemtTekst
    {
        get => _bestemtTekst;
        set => SetField(ref _bestemtTekst, value ?? string.Empty);
    }

    /// <summary>1-baseret position; 1 betyder før det første tegn. Bruges når Placering er VedPosition.</summary>
    public int Tegnposition
    {
        get => _tegnposition;
        set => SetField(ref _tegnposition, value);
    }

    public override WorkingFileName Anvend(WorkingFileName input, RenameRuleContext context)
    {
        if (!ErAktiveret || string.IsNullOrEmpty(Tekst))
            return input;

        var navn = input.NameWithoutExtension;

        var nytNavn = Placering switch
        {
            AddTextPlacement.Start => Tekst + navn,
            AddTextPlacement.Slutning => navn + Tekst,
            AddTextPlacement.FoerFilendelse => navn + Tekst,
            AddTextPlacement.FoerTekst => IndsaetVedTekst(navn, foer: true),
            AddTextPlacement.EfterTekst => IndsaetVedTekst(navn, foer: false),
            AddTextPlacement.VedPosition => IndsaetVedPosition(navn),
            _ => navn
        };

        return input with { NameWithoutExtension = nytNavn };
    }

    private string IndsaetVedTekst(string navn, bool foer)
    {
        if (string.IsNullOrEmpty(BestemtTekst)) return navn;

        var index = navn.IndexOf(BestemtTekst, StringComparison.OrdinalIgnoreCase);
        if (index < 0) return navn;

        var indsaetPunkt = foer ? index : index + BestemtTekst.Length;
        return navn.Insert(indsaetPunkt, Tekst);
    }

    private string IndsaetVedPosition(string navn)
    {
        var index = Math.Clamp(Tegnposition - 1, 0, navn.Length);
        return navn.Insert(index, Tekst);
    }
}
