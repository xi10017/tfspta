import * as fs from 'fs';
import * as path from 'path';

interface CompetitionEntry {
  slug: string;
  name: string;
  subject: string;
  description: string;
  format: string;
  contact: string;
  eligibility: string;
  period: string;
  level: string;
  link: string;
}

const competitions: CompetitionEntry[] = [
  // --- Math ---
  {
    slug: "mu-alpha-theta",
    name: "Mu Alpha Theta",
    subject: "Math",
    description: "Mu Alpha Theta math competitions are the primary math competition of the Frazer Math Team, and is the competition that all members of the math team compete in.",
    format: "Invidiual: 30 questions, 60 minutes. Team (4 people per team): 12 questions, 4 minutes per question.",
    contact: "Mr. Frazer, Mr. Lu",
    eligibility: "math team",
    period: "Regional/Invitationals: January-March. State Convention: April. National Convention: July",
    level: "regional+state+national",
    link: "https://mualphatheta.org/"
  },
  {
    slug: "amc-aime",
    name: "AMC/AIME",
    subject: "Math",
    description: "AMC stands for American Mathemiatics Competition, it is a test taken by students to demonstrate problem-solving skills in algebra, geometry, number theory, and counting. American Invitational Mathematics Examination (AIME) is a test for top scorers in AMC",
    format: "AMC is 25-question, 75/40 minute, multiple-choice test, while AIME is 15-question, 3-hour exam",
    contact: "Mr Frazer, Mr Lu",
    eligibility: "math team",
    period: "November and January for AMC and AIME is usually in February",
    level: "national",
    link: "https://maa.org/student-programs/amc/"
  },
  {
    slug: "mathcounts",
    name: "Mathcounts",
    subject: "Math",
    description: "Mathcounts is a national extracurricular mathematics program and competition series for U.S. middle school students that consists in four main rounds, Sprint, Target, Team, and Countdown, it is designed to foster problem-solving skills and interest in STEM",
    format: "A 30-question, 40-minute non-calculator Sprint Round, followed by an 8-question, calculator-allowed Target Round, a 10-question Team Round, and a rapid Countdown Round",
    contact: "Mr. Frazer, Mr. Lu",
    eligibility: "middle school math team",
    period: "For school to state level it runs from November to March, but the national competition is in May",
    level: "regional+state+national",
    link: "https://www.mathcounts.org/"
  },
  {
    slug: "math-league",
    name: "Math League",
    subject: "Math",
    description: "Math League is a organization runnning in both in-person and online math competitions for elementary, middle and high school students",
    format: "Math League is a 30-35 multiple-choice questions to be solved in 30-75 minutes without calculators.",
    contact: "Mr. Frazer, Mr. Lu",
    eligibility: "math team",
    period: "Math League competitions usually run from October through July.",
    level: "state",
    link: "https://www.mathleague.org/"
  },
  {
    slug: "arml",
    name: "ARML",
    subject: "Math",
    description: "ARML(American Regions Mathematics League) is an annual competition primarily for high schoolers which team of 15 students compete in multiple rounds focus in teamwork, advanced problem solving, and speed.",
    format: "A team of 15 students compete in four main rounds which consists of 20 minute team round, 60 minute power round, an individual round and finally a relay round.",
    contact: "Mr. Frazer, Mr. Lu",
    eligibility: "Math team invite only (by Mr. Lu)",
    period: "ARML loval level is held in April while regionals are held in May.",
    level: "competes in a region consisting of multiple states",
    link: "https://www.arml.com/ARML/arml_2019/page/index.php"
  },
  {
    slug: "himcm",
    name: "HiMCM",
    subject: "Math",
    description: "HiMCM (High School Mathematical Contest in Modeling) is a competition mainly designed for high school students that is an annual international competition.",
    format: "Teams of up to four students use advanced mathematics to solve real-world problems in a period of two days.",
    contact: "Mr. Frazer, Mr. Lu",
    eligibility: "high school",
    period: "HiMCM is usually held in November.",
    level: "national",
    link: "https://www.comap.com/contests/himcm-midmcm"
  },

  // --- Science ---
  {
    slug: "science-olympiad",
    name: "Science Olympiad",
    subject: "Science",
    description: "Frazer School participates at the Regional+State+National level.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "Regional+State+National",
    link: ""
  },
  {
    slug: "science-bowl",
    name: "Science Bowl",
    subject: "Science",
    description: "Frazer School participates at the Regional+National level.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "Regional+National",
    link: ""
  },
  {
    slug: "f-ma-usapho",
    name: "F=MA / USAPhO",
    subject: "Science",
    description: "Frazer School participates at the National level.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "National",
    link: ""
  },
  {
    slug: "physics-bowl",
    name: "Physics Bowl",
    subject: "Science",
    description: "Frazer School participates at the National level.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "National",
    link: ""
  },
  {
    slug: "usabo",
    name: "USABO",
    subject: "Science",
    description: "Frazer School participates at the National level.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "National",
    link: ""
  },
  {
    slug: "usnco",
    name: "USNCO",
    subject: "Science",
    description: "Frazer School participates at the National level.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "National",
    link: ""
  },
  {
    slug: "usaaao",
    name: "USAAAO",
    subject: "Science",
    description: "Frazer School participates at the National level.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "National",
    link: ""
  },
  {
    slug: "useso",
    name: "USESO",
    subject: "Science",
    description: "Frazer School participates at the National level.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "National",
    link: ""
  },
  {
    slug: "hosa",
    name: "HOSA",
    subject: "Science",
    description: "an international career and technical student organization (CTSO) dedicated to empowering students to become leaders in the global health community",
    format: "HOSA competitive events are categorized into six main areas:Health Science, Health Professions, Emergency Preparedness, Leadership, Teamwork, and Recognition; Tests include presnetation events and actual test taking",
    contact: "Discord or dialss@frazerschool.org",
    eligibility: "MS/HS",
    period: "HOSA follows a Annual/School Year Cycle(chapter timelines can be found here:https://hosa.org/wp-content/uploads/2021/01/8.-HOSA-Chapter-Timeline.pdf), Specifically for events rerfer to club or main website",
    level: "Regional/State/National Conferences",
    link: "https://hosa.org/"
  },
  {
    slug: "brain-bee",
    name: "Brain Bee",
    subject: "Science",
    description: "Details coming soon.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "Details coming soon.",
    link: ""
  },

  // --- Debate ---
  {
    slug: "fcdi",
    name: "FCDI",
    subject: "Debate",
    description: "FCDI is a local florida tornament that is the perfect place for new beginers to compete in.",
    format: "N/A",
    contact: "limcc@frazerschool.org",
    eligibility: "middle/high schooler, don't need to be in the team",
    period: "States around April",
    level: "Regional (states is state level but other then that all regionals)",
    link: "https://www.civicsanddebate.com/state-championship"
  },
  {
    slug: "cfl",
    name: "CFL",
    subject: "Debate",
    description: "CFL is a national tornament but its not the hardest tornament and is also a perfect beginer tornament.",
    format: "N/A",
    contact: "limcc@frazerschool.org",
    eligibility: "middle/high schooler, don't need to be in the team",
    period: "Nationals during May",
    level: "Regional (but national is national level); Middle school cannot attend the national tournament",
    link: "https://www.ncflnationals.org/"
  },
  {
    slug: "nsda",
    name: "NSDA",
    subject: "Debate",
    description: "NSDA is a national tornament which middle schoolers can go and highschooler qualify for, NSDA is only recomended to the highest level of speech and debate competitors, you also have the chance to qualify for TOC",
    format: "N/A",
    contact: "limcc@frazerschool.org",
    eligibility: "middle schoolers doesn't need to qualify, but highschoolers needs to be qualified",
    period: "Nationals during May",
    level: "National level with regional qualifiers",
    link: "https://www.speechanddebate.org/nationals2026/"
  },
  {
    slug: "toc",
    name: "TOC",
    subject: "Debate",
    description: "TOC is the highest grade of tornament where the stakes are out of this world where you could be mark down as one of the greatest speech and debater of all time, this tornament is the hardest to qualify for out of the 4 and is qualified by the most high skill speech and debaters, in order to qualify you need 2 TOC bids but there is sometimes exceptions that you earn in the TOC qualifiers, you can earn only one in a single tornament.",
    format: "N/A",
    contact: "limcc@frazerschool.org",
    eligibility: "middle schoolers can qualify(also 2 bids), highschoolers needs to have 2 bids to qualify, but with one you still have a chance.",
    period: "Nationals at Univerisity of Kentucky during April",
    level: "National/World level",
    link: "https://ci.uky.edu/debate/toc"
  },

  // --- Robotics ---
  {
    slug: "mustang-round-up",
    name: "Mustang Round-Up",
    subject: "Robotics",
    description: "A regional competition that allows specifically awarded teams in middle school to qualify for North/Central Florida Regional Championship. The awards that will allow teams to qualify include teamwwork championship, skills challenge, and judging",
    format: "N/A",
    contact: "yus@my.frazerschool.org",
    eligibility: "Middle School teams",
    period: "January 10, 2026",
    level: "Regional",
    link: "https://www.robotevents.com/robot-competitions/vex-iq-competition/RE-VIQRC-25-2891.html#general-info"
  },
  {
    slug: "wwr-january-blended-mix-and-match-tornement",
    name: "WWR January Blended Mix and Match Tornement",
    subject: "Robotics",
    description: "A regional competition that allows teams from elementary and middle school to compete and qualify for Florida Regional Championship. Qualifying awards are Excellence, Teamwork Champion, Design and finally Innovate.",
    format: "N/A",
    contact: "yus@my.frazerschool.org",
    eligibility: "Elementary and Middle school",
    period: "January 24, 2026",
    level: "Regional",
    link: "https://www.robotevents.com/robot-competitions/vex-iq-competition/RE-VIQRC-25-1554.html#general-info"
  },
  {
    slug: "dynamite-doves-vex-iq-robotics-mix-match-challenge",
    name: "Dynamite Doves VEX IQ Robotics Mix & Match Challenge",
    subject: "Robotics",
    description: "A regional competition where teams from North/Central region comes in-person and competes to win all sorts of awards, but only teams who are rewarded with excellence and Teamwork Champion are able to go to Florida Regional Championship",
    format: "N/A",
    contact: "yus@my.frazerschool.org",
    eligibility: "Elementary and Middle school",
    period: "January 31, 2026",
    level: "Regional",
    link: "https://www.robotevents.com/robot-competitions/vex-iq-competition/RE-VIQRC-25-1489.html#general-info"
  },
  {
    slug: "rampage-robotics-rumble-rally",
    name: "RAMpage Robotics Rumble Rally",
    subject: "Robotics",
    description: "A regional competition where teams from elementary and middle schools come together and compete with eachother to win awards and gain one of the three awards that qualify them for states that are Excellence, teamwork and design.",
    format: "N/A",
    contact: "yus@my.frazerschool.org",
    eligibility: "Elementary and Middle school teams",
    period: "February 07, 2026",
    level: "Regional",
    link: "https://www.robotevents.com/robot-competitions/vex-iq-competition/RE-VIQRC-25-3252.html#general-info"
  },
  {
    slug: "ohs-vex-iq-robotics-competition-mix-and-match-tournament",
    name: "OHS VEX IQ Robotics Competition Mix and Match Tournament",
    subject: "Robotics",
    description: "A competition taking place in the region, North/Central, that allows teams from both elementary and middle school teams to qualify for states with awards, Excellence, Teamwork Champion, and design.",
    format: "N/A",
    contact: "yus@my.frazerschool.org",
    eligibility: "Elementary and Middle school teams",
    period: "February 14, 2026",
    level: "Regional",
    link: "https://www.robotevents.com/robot-competitions/vex-iq-competition/RE-VIQRC-25-3425.html#general-info"
  },
  {
    slug: "last-chance-pinecrest-lakes-vex-iq-robotics-competition",
    name: "Last Chance @ Pinecrest Lakes VEX IQ Robotics Competition",
    subject: "Robotics",
    description: "The last regional competition that allows teams that haven't yet qualify fro Florida Regional Championship",
    format: "N/A",
    contact: "yus@my.frazerschool.org",
    eligibility: "MIddle school",
    period: "February 15, 2026",
    level: "Regional",
    link: "https://www.robotevents.com/robot-competitions/vex-iq-competition/RE-VIQRC-25-1625.html#general-info"
  },

  // --- Chess ---
  {
    slug: "2026-florida-state-scholastic-championship-orca",
    name: "2026 Florida State Scholastic Championship – ORCA",
    subject: "Chess",
    description: "Florida State Scholastic Champions is a state wide tornament",
    format: "N/A",
    contact: "ryersonbn@frazerschool.org",
    eligibility: "All students",
    period: "March",
    level: "state",
    link: ""
  },

  // --- Latin ---
  {
    slug: "national-latin-exam-middle-school-easy",
    name: "National Latin Exam Middle School (easy)",
    subject: "Latin",
    description: "Details coming soon.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "Details coming soon.",
    link: ""
  },
  {
    slug: "national-myth-exam-middle-school-easy",
    name: "National Myth Exam Middle school (easy)",
    subject: "Latin",
    description: "Details coming soon.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "Details coming soon.",
    link: ""
  },
  {
    slug: "national-latin-exam-high-school-difficult",
    name: "National Latin Exam High School (difficult)",
    subject: "Latin",
    description: "Details coming soon.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "Details coming soon.",
    link: ""
  },
  {
    slug: "national-myth-exam-high-school-difficult",
    name: "National Myth Exam High school (difficult)",
    subject: "Latin",
    description: "Details coming soon.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "Details coming soon.",
    link: ""
  },

  // --- Social Sciences ---
  {
    slug: "history-bowl",
    name: "History Bowl",
    subject: "Social Sciences",
    description: "History Bowl is a buzzer-based history quiz competition for school teams, it also educates student about world and US history, including politics, arts, and sciences.",
    format: "Matches feature quick buzzer action over four quarters, including tossup questions and rapid-fire rounds which emphasizes individual speed in buzzing, often featuring shorter questions.",
    contact: "Details coming soon.",
    eligibility: "Middle and High",
    period: "Regional/State competitions usually run through September through March and Nationals is held in late April, while Internationals is in June or July",
    level: "Regional, State, National and International",
    link: "https://www.iacompetitions.com/"
  },
  {
    slug: "ethics-bowl",
    name: "Ethics Bowl",
    subject: "Social Sciences",
    description: "Details coming soon.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "Details coming soon.",
    link: ""
  },
  {
    slug: "fbla",
    name: "FBLA",
    subject: "Social Sciences",
    description: "FBLA is the world's largest business career and technical student organization, helping students prepare for careers through academic competitions, leadership development, and networking.",
    format: "Events usually feature a number of MCQs in a certain amount of time with an objective test that covers specific buisness topics or a presentation event which is presented to panel of judges and varies on event",
    contact: "Keerthi Karri keerthikarri10@gmail.com or Cao.Victoria@my.frazerschool.org, Or sponser: Mr. Young",
    eligibility: "MS/HS",
    period: "To qualify for the State tournament, You have to place at the regional conference in november that is usually held in school. For the National conference, varying per event, you need a top placing in the state competition. The entire span of the season lasts from late November to early July",
    level: "Regional, State, National Conference",
    link: "https://www.fbla.org/"
  },
  {
    slug: "deca",
    name: "DECA",
    subject: "Social Sciences",
    description: "DECA is a global, non-profit career and technical student organization (CTSO) with over 300,000 members, focused on preparing high school and college students for careers in marketing, finance, hospitality, and management",
    format: "DECA exams consist of 100 multiple-choice questions covering business, marketing, finance, hospitality, or entrepreneurship topics, typically with a 90-minute time limit. These exams are generally based on National Curriculum Standards and represent 50% of the total score for many events. No penalties exist for guessing, so all questions should be answered.",
    contact: "Cao.Victoria@my.frazerschool.org, Or sponser: Mr. Young",
    eligibility: "MS/HS",
    period: "operates on a yearly competition cycle, with November designated as \"DECA Month\"",
    level: "DECA competition advances through three main levels: District/Regional (local chapters), State/Chartered Association, and the International Career Development Conference (ICDC/Nationals)",
    link: "https://www.deca.org/compete, Deca Practices is combined with FBLA, Meetings are scheduled in advance and sent over email"
  },

  // --- MISC ---
  {
    slug: "spanish-team",
    name: "Spanish Team",
    subject: "MISC",
    description: "Details coming soon.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "Details coming soon.",
    link: ""
  },
  {
    slug: "quiz-bowl",
    name: "Quiz Bowl",
    subject: "MISC",
    description: "Quiz Bowl is a competitive, interscholastic \"varsity sport of the mind\" where focuses on rapid recall of knowledge across history, science, literature, arts, and popular culture.",
    format: "teams of four players use a buzzer system to answer fast-paced, academic questions including tossups which are Paragraph-long questions where players buzz to answer and bonuses where teams can collaborate.",
    contact: "Details coming soon.",
    eligibility: "Middle and High school",
    period: "Local and regional competitions usually run from October through April, while Nationals is often held in Spring.",
    level: "Local, Regionals, Nationals",
    link: "https://hsquizbowl.org/db/tournaments/"
  },
  {
    slug: "iac",
    name: "IAC",
    subject: "MISC",
    description: "International Academic Competitions (IAC) are a global series of buzzer-based, curriculum-focused academic contests for K-12 students, primarily covering history, geography, and science There is ALOT to understand for the competition types and how to actually compete. The IAC website acurately explains everything: https://www.iacompetitions.com/ems/",
    format: "These are quiz bowl-style competitions, using buzzer systems and pyramidal questions (where clues go from hardest to easiest).",
    contact: "Mr.Geering",
    eligibility: "HS/MS",
    period: "Regionals are held throughout the year both online and in person, Nationals depending on the competition happens worldwide",
    level: "Free Online Regional Qualifying Exam/Regional Tournaments/National Championships",
    link: ""
  },
  {
    slug: "spelling-bee",
    name: "Spelling Bee",
    subject: "MISC",
    description: "Details coming soon.",
    format: "N/A",
    contact: "Details coming soon.",
    eligibility: "Details coming soon.",
    period: "Details coming soon.",
    level: "Details coming soon.",
    link: ""
  }
];

// 1. Group the array by subject so we can wrap them in the correct category <div>
const groupedCompetitions: Record<string, CompetitionEntry[]> = {};

competitions.forEach(entry => {
  if (!groupedCompetitions[entry.subject]) {
    groupedCompetitions[entry.subject] = [];
  }
  groupedCompetitions[entry.subject].push(entry);
});

// 2. Build the HTML string using forEach loops
let htmlOutput = `<section>\n`;

// Loop through each subject category
Object.keys(groupedCompetitions).forEach(subject => {
  // Create an ID from the subject (e.g., "Social Sciences" -> "social-sciences")
  const categoryId = subject.toLowerCase().replace(/\s+/g, '-');
  
  htmlOutput += `  <div class="competition-category" id="${categoryId}">\n`;
  htmlOutput += `    <h3 class="school-tier-title">${subject}</h3>\n`;
  htmlOutput += `    <div class="competition-list">\n`;

  // Loop through the individual entries inside this category
  groupedCompetitions[subject].forEach(entry => {
    // Escape quotes in the strings just in case, to prevent broken HTML attributes
    const escapeHTML = (str: string) => str.replace(/"/g, '&quot;');
    
    htmlOutput += `      <competition-entry slug="${escapeHTML(entry.slug)}" name="${escapeHTML(entry.name)}" description="${escapeHTML(entry.description)}" format="${escapeHTML(entry.format)}" contact="${escapeHTML(entry.contact)}" eligibility="${escapeHTML(entry.eligibility)}" period="${escapeHTML(entry.period)}" level="${escapeHTML(entry.level)}" link="${escapeHTML(entry.link)}"></competition-entry>\n`;
  });

  htmlOutput += `    </div>\n`;
  htmlOutput += `  </div>\n`;
});

htmlOutput += `</section>`;

// 3. Save the HTML to a location of your choice
// Change this file path to wherever you want the file to be saved on your computer
const saveLocation = path.join(__dirname, 'src', 'templates', 'site-competitions.html');

fs.writeFileSync(saveLocation, htmlOutput, 'utf8');
