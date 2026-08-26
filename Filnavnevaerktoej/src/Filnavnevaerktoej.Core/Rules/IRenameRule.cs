using System.Text.Json.Serialization;
using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Rules;

/// <summary>Fælles kontrakt for alle omdøbningsregler. Reglerne udføres i den rækkefølge, de er tilføjet i.</summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "Type")]
[JsonDerivedType(typeof(DeleteTextRule), "SletTekst")]
[JsonDerivedType(typeof(ReplaceTextRule), "ErstatTekst")]
[JsonDerivedType(typeof(AddTextRule), "TilfoejTekst")]
[JsonDerivedType(typeof(RegexRenameRule), "Regex")]
[JsonDerivedType(typeof(CaseChangeRule), "StoreSmaaBogstaver")]
[JsonDerivedType(typeof(NumberingRule), "Nummerering")]
public interface IRenameRule : INotifyPropertyChangedMarker
{
    bool ErAktiveret { get; set; }

    /// <summary>Kort dansk visningsnavn for reglen, bruges i UI og logning.</summary>
    string Navn { get; }

    /// <summary>
    /// Anvender reglen på det aktuelle arbejdsnavn og returnerer et nyt (eller uændret) arbejdsnavn.
    /// Reglen må kun kaste for reelt ugyldig konfiguration (fx ugyldig regex); den skal ellers altid
    /// returnere et resultat, så forhåndsvisningen kan fortsætte.
    /// </summary>
    WorkingFileName Anvend(WorkingFileName input, RenameRuleContext context);
}

/// <summary>Markørinterface så regler kan bindes direkte til WPF uden en ekstra ViewModel-indpakning.</summary>
public interface INotifyPropertyChangedMarker : System.ComponentModel.INotifyPropertyChanged
{
}
