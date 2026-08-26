namespace Filnavnevaerktoej.Core.Models;

/// <summary>Status for en enkelt fil i forhåndsvisningen af en omdøbning.</summary>
public enum RenameStatus
{
    Uaendret,
    AendresGyldigt,
    Advarsel,
    Fejl
}

/// <summary>Det faktiske resultat af en gennemført (eller forsøgt) omdøbning af en enkelt fil.</summary>
public enum RenameEntryResult
{
    IkkeUdfoert,
    Succes,
    Fejlet,
    Sprunget_Over
}

/// <summary>Hvor tilføjet tekst skal placeres i filnavnet.</summary>
public enum AddTextPlacement
{
    Start,
    Slutning,
    FoerTekst,
    EfterTekst,
    VedPosition,
    FoerFilendelse
}

/// <summary>Hvilke forekomster en erstat-regel skal ramme.</summary>
public enum ReplaceScope
{
    AlleForekomster,
    FoersteForekomst,
    SidsteForekomst
}

/// <summary>Hvilken del af filnavnet en regex-regel arbejder på.</summary>
public enum RegexTarget
{
    NavnUdenFilendelse,
    HeleFilnavnet
}

/// <summary>Ændring af store/små bogstaver.</summary>
public enum CaseChangeMode
{
    IngenAendring,
    SmaaBogstaver,
    StoreBogstaver,
    FoersteBogstavStort,
    TitelFormat
}

/// <summary>Placering af fortløbende nummerering.</summary>
public enum NumberingPlacement
{
    Start,
    Slutning
}

/// <summary>Status for en tidligere omdøbningsoperation i historikken.</summary>
public enum OperationStatus
{
    GennemfoertUdenFejl,
    GennemfoertMedFejl,
    Fortrudt,
    Afbrudt
}
