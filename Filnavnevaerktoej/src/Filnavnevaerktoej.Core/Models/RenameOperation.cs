namespace Filnavnevaerktoej.Core.Models;

/// <summary>Én gennemført eller forsøgt omdøbningsoperation, gemt til historik/undo.</summary>
public sealed class RenameOperation
{
    public required string OperationId { get; init; }
    public required DateTime TidspunktUtc { get; init; }
    public required string KildeMappe { get; init; }
    public required List<RenameOperationEntry> Entries { get; init; }
    public bool ErFortrudt { get; set; }

    public int AntalOmdoebt => Entries.Count(e => e.Resultat == RenameEntryResult.Succes);
    public int AntalFejlet => Entries.Count(e => e.Resultat == RenameEntryResult.Fejlet);
    public int AntalSprungetOver => Entries.Count(e => e.Resultat == RenameEntryResult.Sprunget_Over);

    public OperationStatus BeregnStatus()
    {
        if (ErFortrudt) return OperationStatus.Fortrudt;
        return AntalFejlet == 0 ? OperationStatus.GennemfoertUdenFejl : OperationStatus.GennemfoertMedFejl;
    }
}

/// <summary>Én fils del af en omdøbningsoperation - bruges både til rapport og undo.</summary>
public sealed class RenameOperationEntry
{
    public required string OprindeligFuldSti { get; init; }
    public required string NyFuldSti { get; init; }
    public RenameEntryResult Resultat { get; set; } = RenameEntryResult.IkkeUdfoert;
    public string? Fejlbesked { get; set; }

    public string OprindeligtFilnavn => Path.GetFileName(OprindeligFuldSti);
    public string NytFilnavn => Path.GetFileName(NyFuldSti);
    public string Filtype => Path.GetExtension(NyFuldSti);
}
