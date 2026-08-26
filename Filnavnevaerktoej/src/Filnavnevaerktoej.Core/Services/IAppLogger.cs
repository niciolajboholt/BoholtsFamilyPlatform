namespace Filnavnevaerktoej.Core.Services;

public interface IAppLogger
{
    void Info(string besked);
    void Advarsel(string besked);
    void Fejl(string besked, Exception? exception = null);
}
