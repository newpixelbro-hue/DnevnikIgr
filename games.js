// название | год | жанр | серия | статус (необязательно)
const CATALOG_RAW = `
Red Dead Redemption|2010|Экшен|Red Dead|done
Red Dead Redemption 2|2018|Экшен|Red Dead|done
Grand Theft Auto V|2013|Экшен|GTA|playing
Grand Theft Auto III|2001|Экшен|GTA
Grand Theft Auto: Vice City|2002|Экшен|GTA
Grand Theft Auto: San Andreas|2004|Экшен|GTA
Grand Theft Auto IV|2008|Экшен|GTA
Max Payne 3|2012|Шутер|Max Payne
L.A. Noire|2011|Детектив||
The Witcher|2007|РПГ|Ведьмак
The Witcher 2: Assassins of Kings|2011|РПГ|Ведьмак
The Witcher 3: Wild Hunt|2015|РПГ|Ведьмак
Cyberpunk 2077|2020|РПГ|
The Last of Us|2013|Экшен|The Last of Us
The Last of Us Part II|2020|Экшен|The Last of Us
Uncharted 2: Among Thieves|2009|Приключение|Uncharted
Uncharted 4: A Thief's End|2016|Приключение|Uncharted
God of War|2018|Экшен|God of War
God of War Ragnarök|2022|Экшен|God of War
Horizon Zero Dawn|2017|РПГ|Horizon
Horizon Forbidden West|2022|РПГ|Horizon
Ghost of Tsushima|2020|Экшен|
Marvel's Spider-Man|2018|Экшен|Spider-Man
Marvel's Spider-Man 2|2023|Экшен|Spider-Man
Death Stranding|2019|Экшен|
Metal Gear Solid 3: Snake Eater|2004|Стелс|Metal Gear
Metal Gear Solid V: The Phantom Pain|2015|Стелс|Metal Gear
Mass Effect|2007|РПГ|Mass Effect
Mass Effect 2|2010|РПГ|Mass Effect
Mass Effect 3|2012|РПГ|Mass Effect
Dragon Age: Inquisition|2014|РПГ|Dragon Age
The Elder Scrolls V: Skyrim|2011|РПГ|Elder Scrolls
Fallout 3|2008|РПГ|Fallout
Fallout: New Vegas|2010|РПГ|Fallout
Fallout 4|2015|РПГ|Fallout
Elden Ring|2022|РПГ|Souls
Dark Souls|2011|РПГ|Souls
Bloodborne|2015|РПГ|Souls
Sekiro: Shadows Die Twice|2019|Экшен|Souls
Resident Evil 2 (2019)|2019|Хоррор|Resident Evil
Resident Evil 4 (2023)|2023|Хоррор|Resident Evil
Resident Evil 7: Biohazard|2017|Хоррор|Resident Evil
Resident Evil Village|2021|Хоррор|Resident Evil
Silent Hill 2|2001|Хоррор|Silent Hill
Alan Wake|2010|Хоррор|Alan Wake
Alan Wake 2|2023|Хоррор|Alan Wake
Control|2019|Экшен|
Detroit: Become Human|2018|Интерактивное кино|
Heavy Rain|2010|Интерактивное кино|
Beyond: Two Souls|2013|Интерактивное кино|
Life is Strange|2015|Интерактивное кино|Life is Strange
The Walking Dead (Telltale)|2012|Интерактивное кино|Telltale
The Wolf Among Us|2013|Интерактивное кино|Telltale
Disco Elysium|2019|РПГ|
Baldur's Gate 3|2023|РПГ|Baldur's Gate
Divinity: Original Sin 2|2017|РПГ|Divinity
Kingdom Come: Deliverance|2018|РПГ|Kingdom Come
Assassin's Creed II|2009|Приключение|Assassin's Creed
Assassin's Creed IV: Black Flag|2013|Приключение|Assassin's Creed
Assassin's Creed Odyssey|2018|РПГ|Assassin's Creed
Assassin's Creed Valhalla|2020|РПГ|Assassin's Creed
Far Cry 3|2012|Шутер|Far Cry
Far Cry 5|2018|Шутер|Far Cry
Watch Dogs 2|2016|Экшен|Watch Dogs
Sleeping Dogs|2012|Экшен|
Mafia II|2010|Экшен|Mafia
Mafia III|2016|Экшен|Mafia
Mafia: Definitive Edition|2020|Экшен|Mafia
BioShock|2007|Шутер|BioShock
BioShock Infinite|2013|Шутер|BioShock
Half-Life 2|2004|Шутер|Half-Life
Half-Life: Alyx|2020|Шутер|Half-Life
Portal 2|2011|Головоломка|Portal
DOOM (2016)|2016|Шутер|Doom
DOOM Eternal|2020|Шутер|Doom
Wolfenstein II: The New Colossus|2017|Шутер|Wolfenstein
Metro 2033|2010|Шутер|Metro
Metro Exodus|2019|Шутер|Metro
S.T.A.L.K.E.R.: Shadow of Chernobyl|2007|Шутер|S.T.A.L.K.E.R.
Tomb Raider (2013)|2013|Приключение|Tomb Raider
Rise of the Tomb Raider|2015|Приключение|Tomb Raider
Shadow of the Tomb Raider|2018|Приключение|Tomb Raider
Batman: Arkham City|2011|Экшен|Batman Arkham
Batman: Arkham Knight|2015|Экшен|Batman Arkham
Hollow Knight|2017|Метроидвания|
Hades|2020|Рогалик|
Celeste|2018|Платформер|
Undertale|2015|РПГ|
Stardew Valley|2016|Симулятор|
It Takes Two|2021|Приключение|
Ratchet & Clank: Rift Apart|2021|Экшен|
Final Fantasy VII Remake|2020|РПГ|Final Fantasy
Final Fantasy X|2001|РПГ|Final Fantasy
Persona 5 Royal|2019|РПГ|Persona
NieR: Automata|2017|РПГ|
Devil May Cry 5|2019|Экшен|Devil May Cry
Dishonored|2012|Стелс|Dishonored
Prey (2017)|2017|Шутер|
Hogwarts Legacy|2023|РПГ|
Star Wars Jedi: Fallen Order|2019|Экшен|Star Wars Jedi
Starfield|2023|РПГ|
Days Gone|2019|Экшен|
Dying Light|2015|Хоррор|Dying Light
The Outer Worlds|2019|РПГ|
`;
const CATALOG = CATALOG_RAW.trim().split('\n').map(l => {
  const [name, year, genre, series, status] = l.split('|');
  return { name, year: +year, genre, series: series || '', status: status || 'wish' };
});
