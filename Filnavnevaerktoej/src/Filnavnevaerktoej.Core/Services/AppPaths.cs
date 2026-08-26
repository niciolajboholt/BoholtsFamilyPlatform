namespace Filnavnevaerktoej.Core.Services;

/// <summary>Centrale stier til programmets egne data i brugerens profil (aldrig brugerens egne filer).</summary>
public static class AppPaths
{
    public const string ProgramMappeNavn = "Filnavnevaerktoej";

    public static string RodMappe =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), ProgramMappeNavn);

    public static string HistorikMappe => Path.Combine(RodMappe, "History");
    public static string ProfilMappe => Path.Combine(RodMappe, "Profiles");
    public static string LogMappe => Path.Combine(RodMappe, "Logs");

    /// <summary>Filendelser der altid tilhører programmets egne data og aldrig må indgå i en omdøbning.</summary>
    public static readonly string[] BeskyttedeFilendelser = { ".fnv-log", ".fnv-undo.json", ".fnv-profil.json" };

    public static void SikrMapperFindes()
    {
        Directory.CreateDirectory(HistorikMappe);
        Directory.CreateDirectory(ProfilMappe);
        Directory.CreateDirectory(LogMappe);
    }
}
