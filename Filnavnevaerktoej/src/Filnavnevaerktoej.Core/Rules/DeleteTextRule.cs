using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Rules;

/// <summary>Sletter alle forekomster af en given tekst fra filnavnet (uden filendelse).</summary>
public sealed class DeleteTextRule : RenameRuleBase
{
    private string _tekstDerSkalSlettes = string.Empty;
    private bool _forskelPaaStoreSmaa;

    public override string Navn => "Slet tekst";

    public string TekstDerSkalSlettes
    {
        get => _tekstDerSkalSlettes;
        set => SetField(ref _tekstDerSkalSlettes, value ?? string.Empty);
    }

    public bool ForskelPaaStoreSmaaBogstaver
    {
        get => _forskelPaaStoreSmaa;
        set => SetField(ref _forskelPaaStoreSmaa, value);
    }

    public override WorkingFileName Anvend(WorkingFileName input, RenameRuleContext context)
    {
        if (!ErAktiveret || string.IsNullOrEmpty(TekstDerSkalSlettes))
            return input;

        var comparison = ForskelPaaStoreSmaaBogstaver ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase;
        var nytNavn = ReplaceAll(input.NameWithoutExtension, TekstDerSkalSlettes, string.Empty, comparison);
        return input with { NameWithoutExtension = nytNavn };
    }

    internal static string ReplaceAll(string kilde, string find, string erstat, StringComparison comparison)
    {
        if (find.Length == 0) return kilde;
        var resultat = new System.Text.StringBuilder();
        var startIndex = 0;
        int foundIndex;
        while ((foundIndex = kilde.IndexOf(find, startIndex, comparison)) >= 0)
        {
            resultat.Append(kilde, startIndex, foundIndex - startIndex);
            resultat.Append(erstat);
            startIndex = foundIndex + find.Length;
        }
        resultat.Append(kilde, startIndex, kilde.Length - startIndex);
        return resultat.ToString();
    }
}
