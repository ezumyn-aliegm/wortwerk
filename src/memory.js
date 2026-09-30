import { WORDS } from './data.js';
import { LEGACY_MEMORY } from './legacy-memory.js';
import { PREVIOUS_WORDS, PREVIOUS_MEMORY } from './previous-content.js';

// Selected by two independent reviewers and TypeSafe/Jev. See the selection report.
export const MEMORY = {
  "brief": {
    "chunks": [
      "Br",
      "ie",
      "f"
    ],
    "scene": "A brief message can go in a letter. English brief and German Brief share the same letters, but der Brief means the letter itself.",
    "watch": "Learn der Brief together. Capital B; ie, not ei. More than one: die Briefe.",
    "recall": "Write ‘the letter’ with its article. Which vowel comes first?"
  },
  "fuehlen": {
    "chunks": [
      "f",
      "ü",
      "hl",
      "en"
    ],
    "scene": "Before a match: Ich fühle mich gut — I feel good. German needs mich here, even though English does not say myself. Learn the whole phrase together.",
    "watch": "sich fühlen: ü, then h. Keep sich when learning the verb; use mich with ich.",
    "recall": "Write ‘to feel’ with its reflexive partner. What follows the umlaut?"
  },
  "aergern": {
    "chunks": [
      "ärger",
      "n"
    ],
    "scene": "Someone's loud video interrupts your homework. Ich ärgere mich über den Lärm. Ärger means annoyance or trouble; here you are getting annoyed by the noise.",
    "watch": "Write sich ärgern: initial ä, then rgern. Ich uses ärgere mich; wir uses ärgern uns.",
    "recall": "Describe getting annoyed about noise, speaking about yourself."
  },
  "traurig": {
    "chunks": [
      "trau",
      "rig"
    ],
    "scene": "Your friend moves away: traurig means sad. It’s a feeling, not tiredness. Learn the word in two short spelling blocks: trau + rig.",
    "watch": "Keep au together. End with rig: the final written letter is g, even if it sounds different.",
    "recall": "Write ‘sad’ from memory. Check the vowel pair and final letter."
  },
  "job": {
    "chunks": [
      "J",
      "ob"
    ],
    "scene": "Easy transfer: a job is der Job. You already know the English spelling; the new information is the German article and capital letter.",
    "watch": "der Job: capital J. Plural die Jobs adds s, just like English.",
    "recall": "Write ‘the job,’ then ‘the jobs.’ Don’t skip the articles."
  },
  "mitkommen": {
    "chunks": [
      "mit",
      "kommen"
    ],
    "scene": "Friends head to the park and invite you along. Mit means with; kommen means come. Ich komme mit. Picture joining their group at the door.",
    "watch": "Write mitkommen as one infinitive, with double m in kommen. In Ich komme mit, mit moves to the end.",
    "recall": "Friends invite you along. Answer in German: I am coming along."
  },
  "umziehen": {
    "chunks": [
      "um",
      "z",
      "ie",
      "h",
      "en"
    ],
    "scene": "Think moving house, not walking across the room: Wir ziehen um — We’re moving. Keep the moving verb as one word when naming it: umziehen.",
    "watch": "um + ziehen. In ziehen, write ie followed by h. In Wir ziehen um, um goes last.",
    "recall": "Write ‘to move house.’ Check the vowel order and the silent letter after it."
  },
  "weit-weg": {
    "chunks": [
      "weit",
      " ",
      "weg"
    ],
    "scene": "Your base is far away on the map: weit weg. Two separate words, two w starts. The space is part of the answer.",
    "watch": "weit has ei; weg ends in g. Keep a space between them.",
    "recall": "Write ‘far away.’ How many words, and which vowel pair comes first?"
  },
  "fast": {
    "chunks": [
      "f",
      "ast"
    ],
    "scene": "Your download is at 99%: fast fertig — almost finished. German fast means almost, not speedy. Think nearly done, not going quickly.",
    "watch": "Same letters as English fast; different meaning. Write f-a-s-t, with no extra letters.",
    "recall": "A download is at 99%. What does fast mean here?"
  },
  "treffen": {
    "chunks": [
      "tre",
      "ff",
      "en"
    ],
    "scene": "Meet your friend at spawn: Wir treffen uns — We meet up. The two f letters make a simple pair to remember: two friends meeting.",
    "watch": "sich treffen: double f, one t at the start. Learn sich too; wir takes uns.",
    "recall": "Write ‘to meet’ with its reflexive partner. Which letter forms a pair?"
  },
  "beide": {
    "chunks": [
      "b",
      "ei",
      "de"
    ],
    "scene": "Two players, and both are ready: beide. Both means exactly two; don’t mix it up with einige, which means some or several.",
    "watch": "b + ei + de. The vowel pair is ei, not ie; finish with e.",
    "recall": "Write the word for ‘both.’ Check the order of its two middle vowels."
  },
  "fahrradtrial": {
    "chunks": [
      "Fahr",
      "rad",
      "trial"
    ],
    "scene": "Bike trials means balancing a bike over obstacles, not riding a trail. Build the name from Fahr + rad + trial; the r letters meet at the join.",
    "watch": "Your class sheet uses der Fahrradtrial. Keep capital F, the rr join, and trial with i before a.",
    "recall": "Write the bike sport using your class sheet’s article. Check the doubled letter and final vowel order."
  },
  "hochfahren": {
    "chunks": [
      "hoch",
      "fahr",
      "en"
    ],
    "scene": "Ride up a hill: hoch means up, fahren means travel by vehicle. Together: hochfahren. In Ich fahre hoch, the up part moves to the end.",
    "watch": "hoch + fahren. Keep ch in hoch and the h after a in fahren.",
    "recall": "Write ‘to go up’ by vehicle. Which two parts make the word?"
  },
  "hoffentlich": {
    "chunks": [
      "ho",
      "ff",
      "en",
      "t",
      "lich"
    ],
    "scene": "Before opening a chest: Hoffentlich! — Hopefully! Link it to hoffen, meaning to hope. For spelling, build hoffen + t + lich; don’t lose that linking t.",
    "watch": "Double f, then the t before lich. End with ch, not ck.",
    "recall": "Write ‘hopefully.’ Check the doubled letter and the letter just before lich."
  },
  "treppe": {
    "chunks": [
      "Tre",
      "ppe"
    ],
    "scene": "At school, you take the staircase to the next floor: Ich gehe die Treppe hoch. Picture the actual steps you use each day.",
    "watch": "die Treppe is one staircase, often called the stairs in English. Several staircases: die Treppen. Keep capital T, double p, and final e in Treppe.",
    "recall": "Name the staircase at school, with its article."
  },
  "stark": {
    "chunks": [
      "st",
      "ark"
    ],
    "scene": "Tony Stark has a strong suit. Use Stark as a name hook for stark — strong. The German adjective stays lowercase; this is a memory link, not a translation rule.",
    "watch": "st + ark. Finish rk, with no vowel between r and k. Lowercase s.",
    "recall": "Write ‘strong.’ Check the two letters at the end."
  },
  "streiten": {
    "chunks": [
      "str",
      "ei",
      "ten"
    ],
    "scene": "Two teammates argue about the plan: Sie streiten — They argue. This is the argument itself; sich ärgern is feeling annoyed.",
    "watch": "str + ei + ten. Three consonants at the start; ei, not ie.",
    "recall": "Write ‘to argue.’ Check the three starting consonants and vowel order."
  },
  "muede": {
    "chunks": [
      "m",
      "ü",
      "de"
    ],
    "scene": "After a late gaming session: Ich bin müde — I’m tired. Keep it separate from traurig: you need sleep, not cheering up.",
    "watch": "m + ü + de. The two dots belong to ü; plain u is a different letter.",
    "recall": "Write ‘tired’ from memory. Which letter needs two dots?"
  },
  "schlecht": {
    "chunks": [
      "sch",
      "le",
      "ch",
      "t"
    ],
    "scene": "A bad connection makes the game lag: schlecht means bad. Build its spelling in four blocks: sch / le / ch / t.",
    "watch": "Start sch. There is another ch before the final t; don’t drop that second h.",
    "recall": "Write ‘bad.’ Can you rebuild all four spelling blocks without looking?"
  },
  "verliebt": {
    "chunks": [
      "ver",
      "lie",
      "bt"
    ],
    "scene": "Liebe means love; verliebt means in love. The shared lieb gives you the meaning and the tricky ie spelling in one useful link.",
    "watch": "ver + lieb + t. Keep ie together; finish bt, not pt.",
    "recall": "Write ‘in love.’ Check the vowel pair and the last two letters."
  },
  "bestimmt": {
    "chunks": [
      "be",
      "sti",
      "mm",
      "t"
    ],
    "scene": "‘Will you join us?’ ‘Definitely!’ That confident answer is bestimmt in this lesson. It’s a yes with confidence, not just a hopeful maybe.",
    "watch": "be + stimmt. Double m followed by t; don’t shorten the ending to one m.",
    "recall": "Write ‘definitely.’ Which consonant doubles before the final t?"
  },
  "gluecklich": {
    "chunks": [
      "gl",
      "ü",
      "ck",
      "lich"
    ],
    "scene": "Glück means luck or happiness. Finding diamonds can make you glücklich — happy. The useful spelling link is Glück + lich, with a lowercase start for the adjective.",
    "watch": "glücklich: lowercase g, ü, ck, then lich. The ending is ch, not ck.",
    "recall": "Write ‘happy.’ Check the umlaut and the two different consonant pairs."
  },
  "sensibel": {
    "chunks": [
      "sensi",
      "bel"
    ],
    "scene": "A friend notices when someone's joke hurts another person. Mein Freund ist sensibel. The shared sensi in sensitive and sensibel anchors the meaning: sensitive.",
    "watch": "Write sensibel with ending bel, not ble. It means sensitive, not the English sensible.",
    "recall": "Which adjective describes a friend who is sensitive to others' feelings?"
  },
  "fleissig": {
    "chunks": [
      "fleiß",
      "ig"
    ],
    "scene": "Your friend keeps working on a build, even when it takes a few tries. Sie ist fleißig — She is hard-working. Think steady effort, not finishing fast.",
    "watch": "fleiß + ig: ei sounds like eye; ß sounds like s, not b. Keep the written ending ig and use the ß button.",
    "recall": "Describe a classmate who consistently works hard on a project."
  },
  "zuhoeren": {
    "chunks": [
      "zu",
      "hören"
    ],
    "scene": "A friend explains something important, and you put your phone down. Ich höre dir zu. Hören means hear; the added zu marks listening attentively to someone.",
    "watch": "Write zuhören with ö. Learn höre dir zu as a phrase: listening to you. German uses dir here, not dich. In Ich höre dir zu, zu goes last.",
    "recall": "Tell a friend: I am listening to you."
  },
  "einige": {
    "chunks": [
      "ei",
      "ni",
      "ge"
    ],
    "scene": "You have some blocks left, not necessarily two: einige. Contrast beide, meaning both of two. Spell it in three small blocks: ei + ni + ge.",
    "watch": "Start ei, not ie. Keep the middle i: ei-ni-ge ends in e.",
    "recall": "Write ‘some’ or ‘several.’ Does this word promise exactly two?"
  },
  "interessieren": {
    "chunks": [
      "inter",
      "ess",
      "ier",
      "en"
    ],
    "scene": "Think of an interest you actually have: games, music, or sports. sich interessieren means to be interested. Use four spelling blocks: inter / ess / ier / en.",
    "watch": "Two r letters, neither doubled: one in inter, another in ier. Double s; ie in ier. Learn sich interessieren für: to be interested in.",
    "recall": "Write ‘to be interested’ with its reflexive partner. Check the double consonant and ie."
  }
};

const originalWords = new Map(WORDS.map(word => [word.id, word]));
const previousWords = new Map(PREVIOUS_WORDS.map(word => [word.id, word]));
const matchesWord = (word, original) => original && Object.keys(original).every(key =>
  JSON.stringify(word[key]) === JSON.stringify(original[key]));
const sameCue = (a, b) => a && b && ['scene', 'watch', 'recall', 'chunks'].every(key =>
  JSON.stringify(a[key]) === JSON.stringify(b[key]));

// Presentation-only update: saved words, drafts, queues and mastery remain untouched.
export function memoryForWord(word, waveId) {
  const original = originalWords.get(word.id);
  if (waveId !== 'wave-1' || !(matchesWord(word, original) || matchesWord(word, previousWords.get(word.id)))) return word.memory;
  if (sameCue(word.memory, LEGACY_MEMORY[word.id]) || sameCue(word.memory, PREVIOUS_MEMORY[word.id]) || sameCue(word.memory, MEMORY[word.id])) {
    return MEMORY[word.id];
  }
  return word.memory;
}

// Upgrade known shipped copy only; keep saved answers, ordering and progress intact.
export function wordForStudy(word, waveId) {
  if (waveId !== 'wave-1' || !matchesWord(word, previousWords.get(word.id))) return word;
  if (word.memory && ![LEGACY_MEMORY[word.id], PREVIOUS_MEMORY[word.id], MEMORY[word.id]].some(cue => sameCue(word.memory, cue))) return word;
  return {...originalWords.get(word.id), memory: memoryForWord(word, waveId)};
}
