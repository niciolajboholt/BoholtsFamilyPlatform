using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Rules;

/// <summary>Erstatter en tekst med en anden - alle, kun første eller kun sidste forekomst.</summary>
public sealed class ReplaceTextRule : RenameRuleBase
{
    private string _find = string.Empty;
    private string _erstatMed = string.Empty;
    private bool _forskelPaaStoreSmaa;
    private ReplaceScope _omfang = ReplaceScope.AlleForekomster;

    public override string Navn => "Erstat tekst";

    public string Find
    {
        get => _find;
        set => SetField(ref _find, value ?? string.Empty);
    }

    public string ErstatMed
    {
        get => _erstatMed;
        set => SetField(ref _erstatMed, value ?? string.Empty);
    }

    public bool ForskelPaaStoreSmaaBogstaver
    {
        get => _forskelPaaStoreSmaa;
        set => SetField(ref _forskelPaaStoreSmaa, value);
    }

    public ReplaceScope Omfang
    {
        get => _omfang;
        set => SetField(ref _omfang, value);
    }

    public override WorkingFileName Anvend(WorkingFileName input, RenameRuleContext context)
    {
        if (!ErAktiveret || string.IsNullOrEmpty(Find))
            return input;

        var comparison = ForskelPaaStoreSmaaBogstaver ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase;
        var kilde = input.NameWithoutExtension;

        string nytNavn = Omfang switch
        {
            ReplaceScope.AlleForekomster => DeleteTextRule.ReplaceAll(kilde, Find, ErstatMed, comparison),
            ReplaceScope.FoersteForekomst => ReplaceForekomst(kilde, Find, ErstatMed, comparison, foerst: true),
            ReplaceScope.SidsteForekomst => ReplaceForekomst(kilde, Find, ErstatMed, comparison, foerst: false),
            _ => kilde
        };

        return input with { NameWithoutExtension = nytNavn };
    }

    private static string ReplaceForekomst(string kilde, string find, string erstat, StringComparison comparison, bool foerst)
    {
        var index = foerst
            ? kilde.IndexOf(find, comparison)
            : kilde.LastIndexOf(find, comparison);

        if (index < 0) return kilde;

        return string.Concat(kilde.AsSpan(0, index), erstat, kilde.AsSpan(index + find.Length));
    }
}
