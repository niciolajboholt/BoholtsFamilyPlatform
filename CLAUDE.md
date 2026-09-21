# CLAUDE.md

Instruktioner til Claude, når der arbejdes i dette repository.

## Sprog — obligatorisk

**Al kommunikation og al brugerrettet tekst skal skrives på dansk.**

Dette gælder uden undtagelse for:

- chat-svar, statusopdateringer og spørgsmål til Nicolaj,
- planer, analyser, konklusioner og testvejledninger,
- PR-titler, PR-beskrivelser og reviewkommentarer,
- commit-beskeder,
- dokumentation, README, CHANGELOG og projektstatus,
- fejltekster, hjælpetekster og øvrig tekst, som vises i appen,
- automatiske og baggrundsbaserede tilbagemeldinger, herunder CI-status og planlagte kontroller.

Engelsk må kun bruges, når det er teknisk nødvendigt, eksempelvis i:

- kildekode og eksisterende kodeidentifikatorer,
- API-navne, biblioteksnavne, filnavne og terminalkommandoer,
- protokolnavne og andre etablerede tekniske betegnelser,
- originale fejlmeddelelser eller citater, som skal gengives præcist.

Eksisterende kodeidentifikatorer må ikke oversættes alene for at opfylde
sprogkravet. Nye kodekommentarer skal som udgangspunkt være på dansk og
følge repositoryets eksisterende konvention med blandt andet
`// Sprint NN: ...`-kommentarer.

Nye testnavne skal som udgangspunkt være på dansk. Hvis en bestemt testfil
eller mappe konsekvent anvender engelsk, må dens etablerede navngivningsstil
bevares, men den brugerrettede forklaring skal stadig være på dansk.

Hvis en standardskabelon eller et værktøj foreslår engelsk tekst, skal den
brugerrettede del oversættes til naturligt dansk før aflevering.

Inden en opgave afsluttes, skal Claude kontrollere, at der ikke er kommet
unødvendig engelsk tekst med i svaret, dokumentationen, PR-materialet eller
andre brugerrettede leverancer.
