namespace Filnavnevaerktoej.Core.Models;

/// <summary>Indstillinger for scanning af en mappe efter filer (trin 1 i wizarden).</summary>
public sealed class FileDiscoveryOptions
{
    public string MappeSti { get; set; } = string.Empty;
    public string FilFilter { get; set; } = "*.*";
    public bool MedtagUndermapper { get; set; }
    public bool MedtagSkjulteFiler { get; set; }
    public bool MedtagSystemfiler { get; set; }
}
