// /**
//  * Cambridge International Curriculum
//  * Cambridge Assessment International Education (CAIE)
//  *
//  * Cambridge Primary: Stages 1–6 (Grades 1–6, ages 5–11)
//  *   Subjects: English (0058), Mathematics (0096), Science (0097),
//  *             Art & Design (0067), Computing (0059), Digital Literacy (0072),
//  *             Global Perspectives (0838), Humanities (0065), Music (0068),
//  *             Physical Education (0069), Wellbeing (0034),
//  *             Modern Foreign Language (0064) – Stages 4–6 only
//  * Lower Secondary: Stages 7–9 (Grades 7–9, ages 11–14)
//  * IGCSE:           Years 10–11 (Grades 10–11, ages 14–16)
//  * AS Level:        Year 12    (Grade 12, ages 16–17)
//  */

// export type CambridgeGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

// export interface CambridgeSubject {
//   name: string
//   code?: string
//   topics: string[]
// }

// export interface CambridgeGradeCurriculum {
//   grade: CambridgeGrade
//   cambridgeLevel: string
//   description: string
//   subjects: CambridgeSubject[]
// }

// export const CAMBRIDGE_CURRICULUM: Record<CambridgeGrade, CambridgeGradeCurriculum> = {
//   1: {
//     grade: 1,
//     cambridgeLevel: 'Cambridge Primary Stage 1',
//     description: 'Cambridge Primary – Stage 1 (ages 5–6)',
//     subjects: [
//       {
//         name: 'Mathematics',
//         // Cambridge Primary Mathematics (0096) – Stage 1
//         topics: [
//           'Numbers – Counting to 20 Forwards and Backwards',
//           'Numbers – Recognising and Writing Numerals 0–20',
//           'Numbers – Comparing and Ordering Numbers to 20',
//           'Addition – Combining Groups of Objects',
//           'Addition – Number Bonds to 10',
//           'Subtraction – Taking Away from a Group',
//           'Subtraction – Difference Between Two Numbers',
//           'Shape – Recognising 2D Shapes: Circle, Square, Triangle, Rectangle',
//           'Shape – Recognising 3D Shapes: Cube, Sphere, Cylinder',
//           'Measures – Comparing Length, Mass and Capacity',
//           'Measures – Sequencing Events: Before, After, Days of the Week',
//           'Data – Sorting Objects by Colour, Shape and Size',
//           'Data – Simple Pictograms and Block Charts',
//         ],
//       },
//       {
//         name: 'English',
//         // Cambridge Primary English (0058) – Stage 1
//         topics: [
//           'Phonics – Letter Sounds (Phonemes) and Blending',
//           'Phonics – CVC Words and Simple Sight Words',
//           'Reading – Reading Simple Sentences with Comprehension',
//           'Reading – Sequencing Events in a Simple Story',
//           'Writing – Forming Letters Correctly',
//           'Writing – Writing CVC Words and Simple Labels',
//           'Writing – Constructing Simple Sentences',
//           'Speaking – Describing Objects and Personal Experiences',
//           'Listening – Following Simple Instructions',
//           'Vocabulary – Naming Common Objects, Animals and Colours',
//         ],
//       },
//       {
//         name: 'Science',
//         // Cambridge Primary Science (0097) – Stage 1
//         topics: [
//           'Living Things – Identifying Plants and Animals',
//           'Living Things – Humans: Body Parts and Senses',
//           'Living Things – Needs of Plants and Animals',
//           'Materials – Recognising Common Materials: Wood, Metal, Plastic, Fabric',
//           'Materials – Properties: Hard/Soft, Rough/Smooth, Shiny/Dull',
//           'Physical Processes – Pushes and Pulls',
//           'Physical Processes – Light Sources: Sun, Lamps, Candles',
//           'Physical Processes – Sounds: Loud and Quiet',
//           'Earth and Environment – Weather: Sunny, Rainy, Windy, Cloudy',
//           'Earth and Environment – Seasonal Changes',
//         ],
//       },
//       {
//         name: 'Art & Design',
//         // Cambridge Primary Art & Design (0067) – Stage 1
//         topics: [
//           'Experiencing – Exploring Textures, Colours and Shapes in the Environment',
//           'Experiencing – Responding to Works of Art with Personal Observations',
//           'Making – Using Basic Materials: Pencils, Paints, Clay and Collage',
//           'Making – Developing Fine Motor Skills Through Art-Making Activities',
//           'Making – Creating Simple Artworks Inspired by Natural Subjects',
//           'Reflecting – Talking About Own Artwork and Describing What Was Made',
//           'Reflecting – Sharing Likes and Dislikes About Artworks Seen',
//           'Thinking and Working Artistically – Exploring and Experimenting with Materials',
//         ],
//       },
//       {
//         name: 'Computing',
//         // Cambridge Primary Computing (0059) – Stage 1
//         topics: [
//           'Computational Thinking – Following Algorithms for Everyday Tasks',
//           'Computational Thinking – Identifying Steps in a Simple Process',
//           'Programming – Recreating Simple Algorithms as Basic Programs',
//           'Programming – Giving Instructions to Control a Simple Programmable Device',
//           'Managing Data – Recording Information Manually Using Simple Formats',
//           'Managing Data – Sorting and Grouping Objects by a Characteristic',
//           'Networks and Digital Communication – Understanding That Devices Connect to Networks',
//           'Computer Systems – Identifying Robots and Their Purposes in Daily Life',
//         ],
//       },
//       {
//         name: 'Digital Literacy',
//         // Cambridge Primary Digital Literacy (0072) – Stage 1
//         topics: [
//           'Tools and Content Creation – Using Basic Input Devices: Mouse, Keyboard, Touchscreen',
//           'Tools and Content Creation – Opening and Closing Applications on a Device',
//           'Tools and Content Creation – Saving and Retrieving Simple Work',
//           'Safety and Wellbeing – Understanding Basic Online Safety Rules',
//           'Safety and Wellbeing – Knowing Trusted Adults to Turn to Online',
//           'Safety and Wellbeing – Recognising Appropriate and Inappropriate Online Content',
//           'The Digital World – Identifying What Technology Can Do in Daily Life',
//           'The Digital World – Recognising Common Digital Devices in School and Home',
//         ],
//       },
//       {
//         name: 'Global Perspectives',
//         // Cambridge Primary Global Perspectives (0838) – Stage 1
//         topics: [
//           'Research – Saying Something Known About a Familiar Topic',
//           'Research – Sharing Personal Knowledge and Experience',
//           'Analysis – Identifying Simple Facts About a Topic',
//           'Reflection – Talking About Personal Views on Simple Issues',
//           'Collaboration – Working Together on a Simple Shared Task',
//           'Communication – Presenting Ideas Simply Using Pictures or Words',
//           'Communication – Listening Attentively While Others Share Their Ideas',
//         ],
//       },
//       {
//         name: 'Humanities',
//         // Cambridge Primary Humanities (0065) – Stage 1: People, Past, Places
//         topics: [
//           'People – Describing What Makes a Community',
//           'People – Identifying Roles People Play in School and Local Community',
//           'People – Recognising How Families and Communities Share and Celebrate',
//           'Past – Exploring Recent History Within Living Memory',
//           'Past – Discussing Changes Over Time Using Photographs and Stories',
//           'Places – Describing Simple Features of the Local Environment',
//           'Places – Using Simple Maps and Symbols to Represent Familiar Places',
//         ],
//       },
//       {
//         name: 'Music',
//         // Cambridge Primary Music (0068) – Stage 1
//         topics: [
//           'Making Music – Recognising and Clapping Basic Pulse and Rhythm',
//           'Making Music – Performing Simple Songs and Rhymes as a Group',
//           'Making Music – Using Voices and Simple Instruments Expressively',
//           'Making Music – Exploring Dynamics: Loud and Soft Sounds',
//           'Making Sense of Music – Listening and Responding to Music Through Movement',
//           'Making Sense of Music – Identifying Different Sources of Sound',
//           'Making Sense of Music – Describing Music Using Simple Vocabulary: Fast, Slow, Loud, Quiet',
//         ],
//       },
//       {
//         name: 'Physical Education',
//         // Cambridge Primary Physical Education (0069) – Stage 1
//         topics: [
//           'Moving Well – Practising Basic Locomotor Skills: Running, Jumping, Skipping',
//           'Moving Well – Developing Body Coordination and Balance',
//           'Understanding Movement – Describing Own Movement with Simple Vocabulary',
//           'Moving Creatively – Exploring Simple Movement Patterns and Sequences',
//           'Taking Part – Playing Simple Games with Basic Rules',
//           'Taking Responsibility – Participating Safely in Physical Activities',
//           'Healthy Bodies – Understanding That Physical Activity Is Good for Health',
//         ],
//       },
//       {
//         name: 'Wellbeing',
//         // Cambridge Primary Wellbeing (0034) – Stage 1
//         topics: [
//           'Understanding Myself – Identifying and Naming a Range of Emotions',
//           'Understanding Myself – Recognising That Experiencing a Wide Range of Emotions Is Normal',
//           'Understanding Myself – Developing a Positive Sense of Identity',
//           'My Relationships – Making Friends and Being Kind',
//           'My Relationships – Discussing the Importance of Inclusion',
//           'My Relationships – Recognising Similarities and Differences Between People',
//           'Navigating My World – Belonging to a Community: School and Family',
//           'Navigating My World – Knowing Personal Safety Rules',
//         ],
//       },
//     ],
//   },

//   2: {
//     grade: 2,
//     cambridgeLevel: 'Cambridge Primary Stage 2',
//     description: 'Cambridge Primary – Stage 2 (ages 6–7)',
//     subjects: [
//       {
//         name: 'Mathematics',
//         // Cambridge Primary Mathematics (0096) – Stage 2
//         topics: [
//           'Numbers – Counting, Reading and Writing to 100',
//           'Numbers – Place Value: Tens and Ones',
//           'Numbers – Ordering and Comparing 2-Digit Numbers',
//           'Addition – Adding 2-Digit Numbers with and without Regrouping',
//           'Subtraction – Subtracting 2-Digit Numbers',
//           'Multiplication – Understanding as Repeated Addition',
//           'Multiplication – 2, 5 and 10 Times Tables',
//           'Division – Sharing into Equal Groups',
//           'Fractions – Halves and Quarters of Shapes and Numbers',
//           'Shape – Properties of 2D and 3D Shapes',
//           'Measures – Measuring Length in cm and m',
//           'Measures – Telling Time to the Hour and Half Hour',
//           'Measures – Using and Comparing Money',
//           'Data – Simple Block Graphs and Tally Charts',
//         ],
//       },
//       {
//         name: 'English',
//         // Cambridge Primary English (0058) – Stage 2
//         topics: [
//           'Phonics – Consonant Clusters and Digraphs (ch, sh, th)',
//           'Phonics – Long Vowel Sounds and Silent Letters',
//           'Reading – Reading Simple Books with Fluency',
//           'Reading – Answering Questions About a Text',
//           'Reading – Predicting What Might Happen Next',
//           'Writing – Writing Sentences with Capital Letters and Full Stops',
//           'Writing – Simple Stories with a Beginning, Middle and End',
//           'Writing – Writing Lists and Labels',
//           'Grammar – Nouns, Verbs and Adjectives',
//           'Grammar – Singular and Plural Nouns',
//           'Spelling – Common High-Frequency Words',
//           'Speaking – Retelling a Story in Sequence',
//         ],
//       },
//       {
//         name: 'Science',
//         // Cambridge Primary Science (0097) – Stage 2
//         topics: [
//           'Living Things – Grouping Plants and Animals',
//           'Living Things – Life Cycles: Butterfly and Frog',
//           'Living Things – What Plants Need to Grow',
//           'Human Biology – Growing and Changing',
//           'Human Biology – Healthy Eating: Food Groups',
//           'Materials – Comparing Materials: Flexible, Rigid, Waterproof',
//           'Materials – Changing Shape: Bending, Twisting, Squashing',
//           'Physical Processes – Forces: Pushes, Pulls and Gravity',
//           'Physical Processes – Magnets and Magnetic Materials',
//           'Physical Processes – Sources of Light and Shadow',
//           'Earth and Environment – Habitats: Ocean, Forest, Desert',
//           'Earth and Environment – Basic Food Chains',
//         ],
//       },
//       {
//         name: 'Art & Design',
//         // Cambridge Primary Art & Design (0067) – Stage 2
//         topics: [
//           'Experiencing – Looking Closely at Artworks and Describing What Is Seen',
//           'Experiencing – Exploring How Artists Use Colour, Shape and Texture',
//           'Making – Creating Artwork Using a Variety of Media and Techniques',
//           'Making – Developing Skills in Drawing, Painting, Printing and Collage',
//           'Making – Making Artwork Inspired by Observation of the World',
//           'Reflecting – Talking About Own and Others\' Artwork Using Simple Art Vocabulary',
//           'Reflecting – Identifying What Worked Well and What Could Be Improved',
//           'Thinking and Working Artistically – Experimenting with Different Materials to Achieve Effects',
//         ],
//       },
//       {
//         name: 'Computing',
//         // Cambridge Primary Computing (0059) – Stage 2
//         topics: [
//           'Computational Thinking – Following and Understanding Linear Algorithms',
//           'Computational Thinking – Identifying and Correcting Simple Errors in Algorithms',
//           'Programming – Recreating Algorithms as Simple Programs',
//           'Programming – Testing and Debugging a Simple Program',
//           'Managing Data – Collecting Categorical Data Using Tally Charts',
//           'Managing Data – Entering and Interpreting Data in Simple Tables',
//           'Networks and Digital Communication – Identifying Devices Connected to a Network',
//           'Computer Systems – Comparing Robots in Fiction with Real-World Robots',
//         ],
//       },
//       {
//         name: 'Digital Literacy',
//         // Cambridge Primary Digital Literacy (0072) – Stage 2
//         topics: [
//           'Tools and Content Creation – Changing Text Appearance: Colour, Size and Font',
//           'Tools and Content Creation – Creating Simple Text Documents with Images',
//           'Tools and Content Creation – Using Drawing Tools to Create Digital Images',
//           'Safety and Wellbeing – Understanding That Users Have Multiple Accounts Online',
//           'Safety and Wellbeing – Keeping Personal Information Private',
//           'Safety and Wellbeing – Identifying Safe and Unsafe Online Behaviour',
//           'The Digital World – Understanding That Technology Communicates Locally and Globally',
//           'The Digital World – Recognising How Technology Helps People in Daily Life',
//         ],
//       },
//       {
//         name: 'Global Perspectives',
//         // Cambridge Primary Global Perspectives (0838) – Stage 2
//         topics: [
//           'Research – Recognising That Different People Know Different Things',
//           'Research – Finding Information from Simple Sources: Books and Adults',
//           'Analysis – Identifying Differences Between Two Points of View',
//           'Reflection – Listening to Others\' Ideas and Considering New Perspectives',
//           'Collaboration – Contributing to a Small Group Discussion',
//           'Communication – Presenting Findings Simply Using Spoken Words or Pictures',
//           'Communication – Asking and Answering Questions About a Topic',
//         ],
//       },
//       {
//         name: 'Humanities',
//         // Cambridge Primary Humanities (0065) – Stage 2: People, Past, Places
//         topics: [
//           'People – Exploring Families and Communities: Similarities and Differences',
//           'People – Identifying How People Help Each Other in Communities',
//           'People – Describing Simple Examples of Work People Do Locally',
//           'Past – Discussing Changes Within Living Memory',
//           'Past – Using Stories and Photographs to Explore the Recent Past',
//           'Places – Describing Features of Local Environments',
//           'Places – Recognising How Weather Affects Daily Life',
//         ],
//       },
//       {
//         name: 'Music',
//         // Cambridge Primary Music (0068) – Stage 2
//         topics: [
//           'Making Music – Performing with Mostly Accurate Timing and Awareness of Pulse',
//           'Making Music – Singing Songs with Melodic Shape Awareness',
//           'Making Music – Playing Simple Rhythmic Patterns on Percussion Instruments',
//           'Making Music – Exploring Pitch: High and Low Sounds',
//           'Making Sense of Music – Listening and Responding to Music Through Movement',
//           'Making Sense of Music – Asking and Answering Questions About Music Heard',
//           'Making Sense of Music – Using Simple Vocabulary to Describe Music: Fast, Slow, High, Low',
//         ],
//       },
//       {
//         name: 'Physical Education',
//         // Cambridge Primary Physical Education (0069) – Stage 2
//         topics: [
//           'Moving Well – Developing Ball Skills: Throwing, Catching, Kicking',
//           'Moving Well – Practising Coordination in Movement Games',
//           'Understanding Movement – Describing Movement Using Simple Vocabulary',
//           'Moving Creatively – Exploring Gymnastics Basics: Rolling, Balancing, Jumping',
//           'Taking Part – Playing Cooperative and Simple Competitive Games',
//           'Taking Responsibility – Following Safety Rules in Physical Activities',
//           'Healthy Bodies – Understanding Basic Healthy Lifestyle Habits',
//         ],
//       },
//       {
//         name: 'Wellbeing',
//         // Cambridge Primary Wellbeing (0034) – Stage 2
//         topics: [
//           'Understanding Myself – Recognising How Different Situations Affect Feelings',
//           'Understanding Myself – Developing Strategies for Managing Difficult Feelings',
//           'Understanding Myself – Building a Positive Sense of Self',
//           'My Relationships – Being Kind and Respectful to Others',
//           'My Relationships – Understanding the Importance of Inclusion',
//           'My Relationships – Recognising Similarities and Differences Between People',
//           'Navigating My World – Staying Safe at School, Home and Online',
//           'Navigating My World – Identifying Trusted Adults Who Can Help',
//         ],
//       },
//     ],
//   },

//   3: {
//     grade: 3,
//     cambridgeLevel: 'Cambridge Primary Stage 3',
//     description: 'Cambridge Primary – Stage 3 (ages 7–8)',
//     subjects: [
//       {
//         name: 'Mathematics',
//         // Cambridge Primary Mathematics (0096) – Stage 3
//         topics: [
//           'Numbers – Reading, Writing and Ordering Numbers to 1000',
//           'Numbers – Place Value: Hundreds, Tens and Ones',
//           'Numbers – Rounding to the Nearest 10 and 100',
//           'Addition and Subtraction – 3-Digit Numbers with Regrouping',
//           'Multiplication – 3, 4 and 6 Times Tables',
//           'Multiplication – Multiplying 2-Digit by 1-Digit Numbers',
//           'Division – Dividing with Remainders',
//           'Fractions – Thirds, Quarters and Eighths',
//           'Fractions – Comparing and Ordering Unit Fractions',
//           'Decimals – Introduction: Tenths as Fractions and Decimals',
//           'Shape – Symmetry in 2D Shapes',
//           'Shape – Angles: Right Angles, Acute and Obtuse',
//           'Measures – Perimeter of Simple Shapes',
//           'Measures – Telling Time to 5 Minutes and 12/24-Hour Clock',
//           'Data – Interpreting Bar Charts and Pictograms',
//           'Data – Venn Diagrams and Carroll Diagrams',
//         ],
//       },
//       {
//         name: 'English',
//         // Cambridge Primary English (0058) – Stage 3
//         topics: [
//           'Reading – Retrieving Information from Fiction and Non-Fiction',
//           'Reading – Inference: What Characters Feel and Why',
//           'Reading – Identifying the Main Idea',
//           'Writing – Paragraphs and Organising Ideas',
//           'Writing – Descriptive Writing Using Adjectives and Adverbs',
//           'Writing – Recounts: Writing About Events in Order',
//           'Writing – Instructions and Procedural Texts',
//           'Grammar – Sentences: Statements, Questions and Exclamations',
//           'Grammar – Conjunctions: and, but, because, so',
//           'Grammar – Apostrophes for Contraction and Possession',
//           'Spelling – Prefixes (un-, re-) and Suffixes (-ful, -less, -er)',
//           'Vocabulary – Using a Dictionary',
//           'Speaking – Presenting Ideas Clearly to a Group',
//         ],
//       },
//       {
//         name: 'Science',
//         // Cambridge Primary Science (0097) – Stage 3
//         topics: [
//           'Living Things – Classifying Living Things: Plants, Animals, Microbes',
//           'Living Things – Adaptations to Habitats',
//           'Human Biology – Skeleton and Muscles',
//           'Human Biology – Diet, Exercise and Health',
//           'Plants – Parts of a Plant and Their Functions',
//           'Plants – Pollination and Seed Dispersal',
//           'Materials – Mixing Materials: Reversible and Irreversible Changes',
//           'Materials – Rocks and Soils: Properties and Uses',
//           'Physical Processes – Light: Reflection and Shadow Direction',
//           'Physical Processes – Sound: Vibration, Pitch and Volume',
//           'Physical Processes – Electricity: Simple Circuits',
//           'Earth and Environment – The Water Cycle',
//           'Earth and Environment – Recycling and Waste',
//         ],
//       },
//       {
//         name: 'Art & Design',
//         // Cambridge Primary Art & Design (0067) – Stage 3
//         topics: [
//           'Experiencing – Comparing Works of Art from Different Cultures and Times',
//           'Experiencing – Responding to Art Using Developing Vocabulary',
//           'Making – Developing Work in a Visual Journal or Sketchbook',
//           'Making – Exploring a Range of Techniques: Weaving, Printing, Sculpture',
//           'Making – Using Formal Elements (Line, Colour, Texture, Form) in Artwork',
//           'Reflecting – Discussing How and Why Artists Make Choices',
//           'Reflecting – Evaluating Own Work Against Intended Outcomes',
//           'Thinking and Working Artistically – Planning and Developing Ideas Before Making',
//         ],
//       },
//       {
//         name: 'Computing',
//         // Cambridge Primary Computing (0059) – Stage 3
//         topics: [
//           'Computational Thinking – Following, Editing and Correcting Linear Algorithms',
//           'Computational Thinking – Decomposing a Problem into Smaller Steps',
//           'Programming – Creating Programs with Multiple Algorithms',
//           'Programming – Testing Programs and Identifying Logic Errors',
//           'Managing Data – Recording Discrete and Categorical Data in Tables',
//           'Managing Data – Creating Simple Charts from Collected Data',
//           'Networks and Digital Communication – Identifying Networked Hardware in School and Home',
//           'Computer Systems – Explaining How Robots Are Used in Manufacturing',
//         ],
//       },
//       {
//         name: 'Digital Literacy',
//         // Cambridge Primary Digital Literacy (0072) – Stage 3
//         topics: [
//           'Tools and Content Creation – Creating Simple Documents Combining Text and Images',
//           'Tools and Content Creation – Using Presentation Software to Share Information',
//           'Tools and Content Creation – Formatting Documents for Clarity',
//           'Safety and Wellbeing – Understanding Privacy Settings on Digital Platforms',
//           'Safety and Wellbeing – Recognising How to Stay Safe When Using Technology for Research',
//           'Safety and Wellbeing – Understanding the Importance of Reporting Concerns',
//           'The Digital World – Using Technology Effectively for Research and Learning',
//           'The Digital World – Evaluating Simple Information Found Online',
//         ],
//       },
//       {
//         name: 'Global Perspectives',
//         // Cambridge Primary Global Perspectives (0838) – Stage 3
//         topics: [
//           'Research – Recognising That People Think and Believe Different Things',
//           'Research – Finding Information from Multiple Simple Sources',
//           'Analysis – Comparing Local and Global Perspectives on a Topic',
//           'Evaluation – Identifying Whether Information Is Fact or Opinion',
//           'Reflection – Considering How Other People\'s Experiences Differ from One\'s Own',
//           'Collaboration – Working as a Team to Investigate a Question',
//           'Communication – Presenting Research Findings to a Small Audience',
//         ],
//       },
//       {
//         name: 'Humanities',
//         // Cambridge Primary Humanities (0065) – Stage 3: People, Past, Places
//         topics: [
//           'People – Exploring Diverse Communities and What They Share',
//           'People – Giving Examples of Work People Do Locally and Why It Matters',
//           'People – Describing Significant Scientific Discoveries from the Past',
//           'Past – Identifying Significant Historical Events That Shaped Communities',
//           'Past – Using Sources to Find Out About the Past',
//           'Places – Describing Places and Environments Locally and Nationally',
//           'Places – Understanding How Physical Features Shape Where People Live',
//         ],
//       },
//       {
//         name: 'Music',
//         // Cambridge Primary Music (0068) – Stages 3–4
//         topics: [
//           'Making Music – Performing with Mostly Accurate Timing and Increasingly Accurate Tuning',
//           'Making Music – Playing Melodic Instruments with Growing Control',
//           'Making Music – Composing Simple Melodies and Rhythmic Patterns',
//           'Making Music – Rehearsing and Improving Performances',
//           'Making Sense of Music – Listening and Using Technical Language to Describe Music Features',
//           'Making Sense of Music – Identifying Instruments by Sight and Sound',
//           'Making Sense of Music – Comparing Two Pieces of Music and Describing Differences',
//         ],
//       },
//       {
//         name: 'Physical Education',
//         // Cambridge Primary Physical Education (0069) – Stages 1–3
//         topics: [
//           'Moving Well – Practising and Refining Basic Movement Skills in Different Contexts',
//           'Moving Well – Introduction to Team Games and Cooperative Activities',
//           'Understanding Movement – Describing Own and Others\' Movement with Simple Vocabulary',
//           'Moving Creatively – Exploring Dance and Rhythm in Movement',
//           'Taking Part – Understanding and Applying the Concept of Fair Play',
//           'Taking Responsibility – Taking Turns and Supporting Teammates',
//           'Healthy Bodies – Participating in Athletic Activities: Running, Jumping, Throwing',
//         ],
//       },
//       {
//         name: 'Wellbeing',
//         // Cambridge Primary Wellbeing (0034) – Stage 3
//         topics: [
//           'Understanding Myself – Building Resilience When Facing Challenges',
//           'Understanding Myself – Recognising Personal Strengths and Areas for Growth',
//           'Understanding Myself – Understanding That Emotions Can Be Managed',
//           'My Relationships – Developing Healthy and Supportive Relationships',
//           'My Relationships – Recognising Similarities and Differences Between People',
//           'My Relationships – Understanding Why Inclusion Matters',
//           'Navigating My World – Understanding How the World Around Us Affects Wellbeing',
//           'Navigating My World – Identifying Sources of Support in the Community',
//         ],
//       },
//     ],
//   },

//   4: {
//     grade: 4,
//     cambridgeLevel: 'Cambridge Primary Stage 4',
//     description: 'Cambridge Primary – Stage 4 (ages 8–9)',
//     subjects: [
//       {
//         name: 'Mathematics',
//         // Cambridge Primary Mathematics (0096) – Stage 4
//         topics: [
//           'Numbers – Reading, Writing and Ordering Numbers to 10 000',
//           'Numbers – Place Value to Ten Thousands',
//           'Numbers – Negative Numbers on a Number Line',
//           'Arithmetic – Addition and Subtraction of 4-Digit Numbers',
//           'Multiplication – 7, 8 and 9 Times Tables',
//           'Multiplication – Multiplying 3-Digit by 1-Digit Numbers',
//           'Division – Short Division with and without Remainders',
//           'Fractions – Equivalent Fractions',
//           'Fractions – Adding and Subtracting Fractions with the Same Denominator',
//           'Decimals – Hundredths and Ordering Decimals',
//           'Percentages – Introduction: Percent as Parts of 100',
//           'Shape – Properties of Triangles and Quadrilaterals',
//           'Shape – Coordinates in the First Quadrant',
//           'Measures – Area of Rectangles',
//           'Measures – Converting Units: km/m, kg/g, l/ml',
//           'Data – Line Graphs: Plotting and Interpreting',
//           'Probability – Likelihood: Impossible, Unlikely, Likely, Certain',
//         ],
//       },
//       {
//         name: 'English',
//         // Cambridge Primary English (0058) – Stage 4
//         topics: [
//           'Reading – Understanding Text Structure in Fiction',
//           'Reading – Author\'s Purpose and Viewpoint',
//           'Reading – Comparing Characters and Events',
//           'Reading – Non-Fiction: Reports, Explanations and Instructions',
//           'Writing – Narrative Writing: Plot Structure',
//           'Writing – Persuasive Writing: Letters and Adverts',
//           'Writing – Explanation Texts',
//           'Grammar – Fronted Adverbials',
//           'Grammar – Relative Clauses with who, which, where',
//           'Grammar – Direct and Reported Speech',
//           'Grammar – Pronouns and Determiners',
//           'Spelling – Homophones and Words Often Confused',
//           'Vocabulary – Word Families and Root Words',
//         ],
//       },
//       {
//         name: 'Science',
//         // Cambridge Primary Science (0097) – Stage 4
//         topics: [
//           'Living Things – Food Webs and Energy Transfer',
//           'Living Things – Teeth and Digestive System',
//           'Living Things – Reproductive Systems in Plants and Animals',
//           'Human Biology – The Circulatory System: Heart and Blood',
//           'Materials – States of Matter and Changes of State',
//           'Materials – Dissolving: Soluble and Insoluble Substances',
//           'Materials – Separating Mixtures: Filtering, Evaporating',
//           'Physical Processes – Electrical Circuits: Switches and Components',
//           'Physical Processes – Forces: Friction, Air Resistance, Water Resistance',
//           'Physical Processes – Gravity and Weight',
//           'Earth and Environment – Earth\'s Layers: Crust, Mantle, Core',
//           'Earth and Environment – Volcanoes and Earthquakes',
//           'Earth and Environment – Fossils and Geological Time',
//         ],
//       },
//       {
//         name: 'Art & Design',
//         // Cambridge Primary Art & Design (0067) – Stage 4
//         topics: [
//           'Experiencing – Comparing Artworks from Different Cultures, Times and Places',
//           'Experiencing – Discussing How Context Influences an Artist\'s Choices',
//           'Making – Developing and Refining Work in a Visual Journal',
//           'Making – Using Formal Elements Intentionally: Composition, Tone, Pattern',
//           'Making – Creating Artwork That Communicates a Specific Idea or Feeling',
//           'Reflecting – Evaluating Own Work and Setting Targets for Improvement',
//           'Reflecting – Using Art Vocabulary to Discuss and Compare Artworks',
//           'Thinking and Working Artistically – Selecting and Combining Materials for a Purpose',
//         ],
//       },
//       {
//         name: 'Computing',
//         // Cambridge Primary Computing (0059) – Stage 4
//         topics: [
//           'Computational Thinking – Designing Algorithms with Count-Controlled Loops',
//           'Computational Thinking – Identifying Patterns to Simplify Problems',
//           'Programming – Writing Programs That Use Iteration (Loops)',
//           'Programming – Debugging Programs with Loops and Multiple Steps',
//           'Managing Data – Creating and Using Forms for Data Collection',
//           'Managing Data – Sorting, Filtering and Interpreting Data in Spreadsheets',
//           'Networks and Digital Communication – Understanding Servers and Clients in Networks',
//           'Computer Systems – Explaining How Robots Are Used in Service Industries',
//         ],
//       },
//       {
//         name: 'Digital Literacy',
//         // Cambridge Primary Digital Literacy (0072) – Stage 4
//         topics: [
//           'Tools and Content Creation – Editing and Organising Document Layout',
//           'Tools and Content Creation – Using Tables and Graphics to Present Information',
//           'Tools and Content Creation – Creating Simple Multimedia Content',
//           'Safety and Wellbeing – Understanding Benefits and Risks of Online Anonymity',
//           'Safety and Wellbeing – Recognising Cyberbullying and Knowing How to Respond',
//           'Safety and Wellbeing – Understanding How Online Communication Affects Interaction',
//           'The Digital World – Exploring How Online Communication Changes Social Interaction',
//           'The Digital World – Understanding How Digital Tools Support Collaboration',
//         ],
//       },
//       {
//         name: 'Global Perspectives',
//         // Cambridge Primary Global Perspectives (0838) – Stage 4
//         topics: [
//           'Research – Identifying Key Points from Different Perspectives on a Topic',
//           'Research – Collecting Information from a Range of Sources',
//           'Analysis – Analysing Causes and Effects of a Local or Global Issue',
//           'Evaluation – Distinguishing Between Relevant and Irrelevant Information',
//           'Reflection – Considering How Personal Values Influence Views',
//           'Collaboration – Planning and Carrying Out a Group Investigation',
//           'Communication – Presenting Findings in Written and Spoken Form',
//         ],
//       },
//       {
//         name: 'Humanities',
//         // Cambridge Primary Humanities (0065) – Stages 4–6: People, Past, Places
//         topics: [
//           'People – Analysing Characteristics That Communities Share',
//           'People – Describing Employment Structure and the Types of Work in Their Country',
//           'People – Explaining How Scientific Discoveries Caused Social Change',
//           'Past – Explaining How Historical Events Shaped the Present',
//           'Past – Using Primary and Secondary Sources to Investigate the Past',
//           'Places – Describing Human and Physical Geography of Familiar Regions',
//           'Places – Understanding How People Interact with and Change Their Environment',
//         ],
//       },
//       {
//         name: 'Music',
//         // Cambridge Primary Music (0068) – Stages 3–4
//         topics: [
//           'Making Music – Performing with Accurate Timing and Increasing Tuning Accuracy',
//           'Making Music – Playing as Part of an Ensemble with Awareness of Others',
//           'Making Music – Composing Music Using Simple Structures and Patterns',
//           'Making Music – Rehearsing and Refining Performances for an Audience',
//           'Making Sense of Music – Using Technical Language to Describe Music Features',
//           'Making Sense of Music – Identifying How Rhythm, Melody and Dynamics Work Together',
//           'Making Sense of Music – Comparing Musical Styles from Different Traditions',
//         ],
//       },
//       {
//         name: 'Physical Education',
//         // Cambridge Primary Physical Education (0069) – Stages 4–6
//         topics: [
//           'Moving Well – Practising and Consolidating a Broad Range of Movement Skills',
//           'Moving Well – Refining Sports Techniques in Games and Athletics',
//           'Understanding Movement – Describing Movement Using Activity-Specific Vocabulary',
//           'Moving Creatively – Showing Creativity in Competitive and Cooperative Contexts',
//           'Taking Part – Applying Rules and Tactics in Team Games',
//           'Taking Responsibility – Demonstrating Responsibility Towards Self and Others',
//           'Healthy Bodies – Understanding the Relationship Between Exercise and Fitness',
//         ],
//       },
//       {
//         name: 'Wellbeing',
//         // Cambridge Primary Wellbeing (0034) – Stage 4
//         topics: [
//           'Understanding Myself – Developing Emotional Regulation Strategies',
//           'Understanding Myself – Understanding How Emotions Can Change Over Time',
//           'Understanding Myself – Exploring Personal Values and Identity',
//           'My Relationships – Navigating Peer Relationships and Managing Conflict',
//           'My Relationships – Exploring the Difference Between Jokes and Bullying',
//           'My Relationships – Understanding the Importance of Diversity and Respect',
//           'Navigating My World – Online Safety and Digital Citizenship',
//           'Navigating My World – Understanding Rights and Responsibilities in the Community',
//         ],
//       },
//       {
//         name: 'Modern Foreign Language',
//         // Cambridge Primary Modern Foreign Language (0064) – Stage 4 (begins Stage 4)
//         topics: [
//           'Listening – Recognising Everyday Familiar Words and Phrases Supported by Visuals',
//           'Listening – Understanding Simple Classroom Instructions in the Target Language',
//           'Speaking – Using Isolated Rehearsed Words and Gestures to Communicate',
//           'Speaking – Responding to Simple Questions with Single Words or Short Phrases',
//           'Reading – Matching Written Words to Pictures in Familiar Contexts',
//           'Writing – Writing Isolated Words Copied or from Memory',
//           'Vocabulary – Learning Key Vocabulary for Everyday Topics: Greetings, Numbers, Colours',
//           'Grammar – Recognising Basic Word Patterns and Simple Sentence Structures',
//           'Cultural Understanding – Recognising the Benefits of Speaking Another Language',
//         ],
//       },
//     ],
//   },

//   5: {
//     grade: 5,
//     cambridgeLevel: 'Cambridge Primary Stage 5',
//     description: 'Cambridge Primary – Stage 5 (ages 9–10)',
//     subjects: [
//       {
//         name: 'Mathematics',
//         // Cambridge Primary Mathematics (0096) – Stage 5
//         topics: [
//           'Numbers – Reading, Writing and Ordering Numbers to 1 000 000',
//           'Numbers – Prime Numbers, Factors and Multiples',
//           'Numbers – Square Numbers and Square Roots',
//           'Arithmetic – Order of Operations (BODMAS)',
//           'Fractions – Multiplying Fractions by Whole Numbers',
//           'Fractions – Mixed Numbers and Improper Fractions',
//           'Decimals – Multiplying and Dividing Decimals by 10, 100, 1000',
//           'Percentages – Finding Percentages of Amounts',
//           'Ratio and Proportion – Introduction',
//           'Algebra – Simple Formulae and Substitution',
//           'Algebra – Number Patterns and Sequences',
//           'Shape – Angles: Measuring with a Protractor, Angles in a Triangle',
//           'Shape – Reflections and Translations on a Grid',
//           'Measures – Converting Between Units of Area and Volume',
//           'Statistics – Mean, Median, Mode and Range of Small Data Sets',
//           'Statistics – Interpreting Line Graphs and Pie Charts',
//         ],
//       },
//       {
//         name: 'English',
//         // Cambridge Primary English (0058) – Stage 5
//         topics: [
//           'Reading – Inference and Deduction in Complex Texts',
//           'Reading – Analysing Language Choices by Authors',
//           'Reading – Themes and Messages in Fiction',
//           'Reading – Bias and Reliability in Non-Fiction',
//           'Writing – Extended Narrative with Developed Characters',
//           'Writing – Newspaper Reports',
//           'Writing – Balanced Arguments and Discussion Texts',
//           'Grammar – Passive Voice',
//           'Grammar – Modal Verbs: could, should, might, must',
//           'Grammar – Parenthesis: Brackets, Dashes and Commas',
//           'Grammar – Colons and Semi-Colons',
//           'Spelling – Words with Silent Letters and Unstressed Vowels',
//           'Vocabulary – Formal and Informal Register',
//           'Speaking – Preparing and Delivering a Short Speech',
//         ],
//       },
//       {
//         name: 'Science',
//         // Cambridge Primary Science (0097) – Stage 5
//         topics: [
//           'Living Things – Classification Keys',
//           'Living Things – Micro-organisms: Bacteria, Viruses and Fungi',
//           'Living Things – The Human Lifecycle',
//           'Human Biology – The Nervous System: Brain, Nerves and Senses',
//           'Human Biology – Puberty and Adolescent Changes',
//           'Plants – Photosynthesis and Respiration in Plants',
//           'Materials – Properties: Hardness, Conductivity, Transparency',
//           'Materials – Thermal and Electrical Conductors and Insulators',
//           'Physical Processes – Forces: Balanced and Unbalanced Forces',
//           'Physical Processes – Levers, Pulleys and Gears as Simple Machines',
//           'Physical Processes – The Solar System: Planets and Moons',
//           'Physical Processes – Earth in Space: Day/Night and Seasons',
//           'Earth and Environment – Ecosystems and Biodiversity',
//           'Earth and Environment – Climate Change and Human Impact',
//         ],
//       },
//       {
//         name: 'Art & Design',
//         // Cambridge Primary Art & Design (0067) – Stage 5
//         topics: [
//           'Experiencing – Studying and Interpreting Artworks from a Variety of Contexts',
//           'Experiencing – Comparing How Different Artists Convey Ideas and Emotions',
//           'Making – Creating Personal Interpretations of Artworks Studied',
//           'Making – Demonstrating Growing Independence in Choice of Materials and Techniques',
//           'Making – Developing a Body of Related Work with a Coherent Theme',
//           'Reflecting – Articulating How Own Work Has Developed Through a Creative Process',
//           'Reflecting – Giving and Receiving Constructive Feedback on Artwork',
//           'Thinking and Working Artistically – Making Informed Choices About How to Develop Work',
//         ],
//       },
//       {
//         name: 'Computing',
//         // Cambridge Primary Computing (0059) – Stage 5
//         topics: [
//           'Computational Thinking – Designing Algorithms with Selection (If/Else)',
//           'Computational Thinking – Abstracting Key Information to Solve Problems',
//           'Programming – Writing Programs Where Objects Interact',
//           'Programming – Using Variables and Conditions in Programs',
//           'Managing Data – Collecting and Organising Data for Related Research Questions',
//           'Managing Data – Analysing Patterns in Data Using Charts and Graphs',
//           'Networks and Digital Communication – Understanding Switches, Routers and Wi-Fi Access Points',
//           'Computer Systems – Explaining How Artificial Intelligence Simulates Human Intelligence',
//         ],
//       },
//       {
//         name: 'Digital Literacy',
//         // Cambridge Primary Digital Literacy (0072) – Stage 5
//         topics: [
//           'Tools and Content Creation – Creating Multimedia Presentations with Text, Images and Animation',
//           'Tools and Content Creation – Selecting Appropriate Digital Tools for a Task',
//           'Tools and Content Creation – Combining Different Media to Communicate Effectively',
//           'Safety and Wellbeing – Understanding Digital Footprints and Online Reputation',
//           'Safety and Wellbeing – Evaluating the Reliability and Accuracy of Online Information',
//           'Safety and Wellbeing – Understanding How to Manage Privacy and Personal Data',
//           'The Digital World – Analysing How the Internet Enables Communication and Collaboration',
//           'The Digital World – Recognising the Impact of Technology on Society',
//         ],
//       },
//       {
//         name: 'Global Perspectives',
//         // Cambridge Primary Global Perspectives (0838) – Stage 5
//         topics: [
//           'Research – Evaluating Sources for Reliability and Relevance',
//           'Research – Synthesising Information from Multiple Sources',
//           'Analysis – Analysing Different Perspectives on a Global Issue',
//           'Evaluation – Assessing the Strengths and Weaknesses of an Argument',
//           'Reflection – Suggesting Realistic Solutions to Community and Global Problems',
//           'Collaboration – Taking on Roles and Responsibilities in a Team Project',
//           'Communication – Presenting Findings Clearly to Different Audiences',
//         ],
//       },
//       {
//         name: 'Humanities',
//         // Cambridge Primary Humanities (0065) – Stage 5: People, Past, Places
//         topics: [
//           'People – Exploring World Cultures, Beliefs and Worldviews',
//           'People – Analysing How Employment and Economy Shape Communities',
//           'People – Understanding How Scientific Discoveries Changed Society Over Time',
//           'Past – Studying History and Its Different Interpretations',
//           'Past – Evaluating the Reliability of Historical Sources',
//           'Places – Describing Global Geography: Continents, Climates and Environments',
//           'Places – Exploring How Human Activity Shapes Physical Environments',
//         ],
//       },
//       {
//         name: 'Music',
//         // Cambridge Primary Music (0068) – Stages 5–6
//         topics: [
//           'Making Music – Performing with Increasing Confidence, Expression and Musicality',
//           'Making Music – Demonstrating Technical Skill on a Chosen Instrument or Voice',
//           'Making Music – Composing Music That Reflects a Theme or Emotion',
//           'Making Music – Collaborating in Ensemble Performances',
//           'Making Sense of Music – Discussing How Music Reflects the Context in Which It Was Created',
//           'Making Sense of Music – Comparing Music from Different Genres and Time Periods',
//           'Making Sense of Music – Using Detailed Vocabulary to Analyse Musical Features',
//         ],
//       },
//       {
//         name: 'Physical Education',
//         // Cambridge Primary Physical Education (0069) – Stage 5
//         topics: [
//           'Moving Well – Applying Tactics in Team Sports and Competitive Activities',
//           'Moving Well – Refining Athletic Performance in Running, Jumping and Throwing',
//           'Understanding Movement – Analysing and Improving Performance Using Feedback',
//           'Moving Creatively – Creating and Performing Expressive Dance Sequences',
//           'Taking Part – Demonstrating Sporting Behaviour in Competitive Contexts',
//           'Taking Responsibility – Supporting and Encouraging Peers During Activity',
//           'Healthy Bodies – Understanding Health-Related Fitness: Strength, Stamina, Flexibility',
//         ],
//       },
//       {
//         name: 'Wellbeing',
//         // Cambridge Primary Wellbeing (0034) – Stage 5
//         topics: [
//           'Understanding Myself – Developing Self-Identity and Confidence',
//           'Understanding Myself – Understanding How Emotions Change Over Time and in Different Contexts',
//           'Understanding Myself – Exploring Personal Goals and Aspirations',
//           'My Relationships – Navigating Peer Pressure and Making Positive Choices',
//           'My Relationships – Understanding Healthy and Unhealthy Relationship Dynamics',
//           'My Relationships – Appreciating Diversity and Its Importance in Communities',
//           'Navigating My World – Taking Responsibility in the Local Community',
//           'Navigating My World – Understanding How Global Issues Affect Individuals',
//         ],
//       },
//       {
//         name: 'Modern Foreign Language',
//         // Cambridge Primary Modern Foreign Language (0064) – Stage 5
//         topics: [
//           'Listening – Understanding Short Simple Personal Questions in the Target Language',
//           'Listening – Identifying Key Information in Short Spoken Passages',
//           'Speaking – Using Isolated Rehearsed Words and Phrases to Communicate',
//           'Speaking – Responding to Questions with Short Phrases in the Target Language',
//           'Reading – Reading Short Simple Texts with Familiar Vocabulary',
//           'Writing – Writing Words and Short Phrases Using a Dictionary for Support',
//           'Vocabulary – Expanding Topic Vocabulary: Family, School, Food, Animals',
//           'Grammar – Using Simple Noun–Adjective Agreement and Basic Verb Forms',
//           'Cultural Understanding – Recognising Cultural Differences in Target Language Countries',
//         ],
//       },
//     ],
//   },

//   6: {
//     grade: 6,
//     cambridgeLevel: 'Cambridge Primary Stage 6',
//     description: 'Cambridge Primary – Stage 6 (ages 10–11)',
//     subjects: [
//       {
//         name: 'Mathematics',
//         // Cambridge Primary Mathematics (0096) – Stage 6
//         topics: [
//           'Numbers – Ordering Integers, Decimals and Fractions on a Number Line',
//           'Numbers – Index Notation: Squares and Cubes',
//           'Arithmetic – Long Multiplication and Long Division',
//           'Fractions – Dividing Fractions by Whole Numbers',
//           'Fractions – Adding and Subtracting Fractions with Different Denominators',
//           'Percentages – Percentage Increase and Decrease',
//           'Ratio – Dividing Quantities in a Given Ratio',
//           'Algebra – Solving Linear Equations with One Variable',
//           'Algebra – Generating and Describing Sequences',
//           'Coordinate Geometry – Coordinates in All Four Quadrants',
//           'Shape – Interior and Exterior Angles of Polygons',
//           'Shape – Nets of 3D Shapes',
//           'Mensuration – Volume of Cuboids',
//           'Mensuration – Circumference and Area of Circles (Introduction)',
//           'Statistics – Averages and Range from Frequency Tables',
//           'Statistics – Comparing Data Sets using Charts and Averages',
//           'Probability – Probability Scale 0 to 1 and Simple Events',
//         ],
//       },
//       {
//         name: 'English',
//         // Cambridge Primary English (0058) – Stage 6
//         topics: [
//           'Reading – Analysing Structure and Organisation of Texts',
//           'Reading – Comparing Texts from Different Periods',
//           'Reading – Evaluating Effectiveness of Writer\'s Techniques',
//           'Reading – Summarising Key Points from Non-Fiction',
//           'Writing – Crafting Opening Paragraphs and Hooks',
//           'Writing – Writing for Different Audiences and Purposes',
//           'Writing – Formal and Informal Letters',
//           'Writing – Reviews and Evaluations',
//           'Grammar – Complex Sentences and Embedded Clauses',
//           'Grammar – Sentence Variety for Effect',
//           'Grammar – Range of Punctuation for Clarity and Effect',
//           'Vocabulary – Figurative Language: Metaphor, Simile, Personification',
//           'Vocabulary – Etymology and Word Origins',
//           'Speaking – Structured Discussion and Debate',
//         ],
//       },
//       {
//         name: 'Science',
//         // Cambridge Primary Science (0097) – Stage 6
//         topics: [
//           'Living Things – Variation Within a Species',
//           'Living Things – Adaptation to Environments',
//           'Living Things – Classification of Living Things Using Keys',
//           'Human Biology – Organ Systems Working Together',
//           'Human Biology – Healthy Living: Exercise, Diet and Lifestyle',
//           'Materials – Physical vs Chemical Changes',
//           'Materials – Mixing and Separating Materials',
//           'Materials – Properties of Materials and Their Uses',
//           'Physical Processes – Light: Reflection, Refraction and Colour',
//           'Physical Processes – Electricity: Series and Parallel Circuits',
//           'Physical Processes – Forces: Balanced and Unbalanced Forces',
//           'Physical Processes – Magnets and Magnetic Fields',
//           'Earth and Environment – The Carbon Cycle',
//           'Earth and Environment – Renewable and Non-Renewable Energy Sources',
//           'Earth and Environment – Pollution, Conservation and Sustainability',
//         ],
//       },
//       {
//         name: 'Art & Design',
//         // Cambridge Primary Art & Design (0067) – Stage 6
//         topics: [
//           'Experiencing – Analysing How Artworks Communicate Meaning Across Cultures',
//           'Experiencing – Researching Artists and Movements to Inform Own Practice',
//           'Making – Creating Interpretations of Artworks That Demonstrate Independence',
//           'Making – Selecting, Combining and Refining Materials with Skill and Purpose',
//           'Making – Producing a Resolved Artwork That Communicates Intent Clearly',
//           'Reflecting – Evaluating Own and Others\' Work Using Appropriate Art Vocabulary',
//           'Reflecting – Articulating Creative Decisions Made Throughout the Process',
//           'Thinking and Working Artistically – Demonstrating Independence and Originality in Creative Work',
//         ],
//       },
//       {
//         name: 'Computing',
//         // Cambridge Primary Computing (0059) – Stage 6
//         topics: [
//           'Computational Thinking – Representing Algorithms as Flowcharts',
//           'Computational Thinking – Using Decomposition and Abstraction to Design Solutions',
//           'Programming – Writing Block-Based Programs with Interrelated Algorithms',
//           'Programming – Using Variables, Loops, Conditions and Events in Programs',
//           'Managing Data – Designing Forms to Collect Continuous Data',
//           'Managing Data – Analysing and Drawing Conclusions from Collected Data',
//           'Networks and Digital Communication – Understanding How Digital Content Is Stored on Servers',
//           'Computer Systems – Explaining How Robots Work Autonomously in Real-World Contexts',
//         ],
//       },
//       {
//         name: 'Digital Literacy',
//         // Cambridge Primary Digital Literacy (0072) – Stage 6
//         topics: [
//           'Tools and Content Creation – Creating Sophisticated Digital Projects with Sound, Video and Text',
//           'Tools and Content Creation – Planning and Structuring a Complex Digital Product',
//           'Tools and Content Creation – Evaluating and Improving Own Digital Work',
//           'Safety and Wellbeing – Understanding the Digital Footprint as a Permanent Record of Online Activity',
//           'Safety and Wellbeing – Managing Online Identity and Reputation Responsibly',
//           'Safety and Wellbeing – Understanding Legal and Ethical Issues in Digital Contexts',
//           'The Digital World – Understanding How Online Streaming Changed How People Access Media',
//           'The Digital World – Evaluating the Benefits and Challenges of Living in a Digital Society',
//         ],
//       },
//       {
//         name: 'Global Perspectives',
//         // Cambridge Primary Global Perspectives (0838) – Stage 6
//         topics: [
//           'Research – Independently Researching a Global Issue Using Multiple Sources',
//           'Research – Synthesising Evidence to Support an Argument',
//           'Analysis – Analysing Multiple Perspectives and Their Underlying Assumptions',
//           'Evaluation – Critically Evaluating Arguments and Counter-Arguments',
//           'Reflection – Reflecting on How Learning Has Changed Personal Understanding',
//           'Collaboration – Leading and Contributing to Group Investigations',
//           'Communication – Creating Arguments Supported by Evidence and Presenting to Different Audiences',
//         ],
//       },
//       {
//         name: 'Humanities',
//         // Cambridge Primary Humanities (0065) – Stage 6: People, Past, Places
//         topics: [
//           'People – Analysing Society and Economy: Structure, Roles and Interdependence',
//           'People – Describing How Employment and Industry Shape National Identity',
//           'People – Exploring Diverse Historical Perspectives on Scientific and Social Progress',
//           'Past – Understanding Diverse Historical Perspectives and Contested Narratives',
//           'Past – Evaluating the Significance of Historical Events for the Modern World',
//           'Places – Exploring Sustainability, Environment and Global Responsibility',
//           'Places – Analysing the Relationship Between Human Activity and Environmental Change',
//         ],
//       },
//       {
//         name: 'Music',
//         // Cambridge Primary Music (0068) – Stages 5–6
//         topics: [
//           'Making Music – Performing with Confidence, Expression, Skill and Musicality',
//           'Making Music – Demonstrating Stylistic Awareness in Performance',
//           'Making Music – Composing Music That Demonstrates Understanding of Structure and Style',
//           'Making Music – Directing or Leading a Group Musical Activity',
//           'Making Sense of Music – Discussing How Music Reflects the Contexts in Which It Was Created',
//           'Making Sense of Music – Evaluating Performances Using Appropriate Musical Vocabulary',
//           'Making Sense of Music – Exploring the Cultural and Historical Significance of Music',
//         ],
//       },
//       {
//         name: 'Physical Education',
//         // Cambridge Primary Physical Education (0069) – Stage 6
//         topics: [
//           'Moving Well – Demonstrating Leadership Skills in Sport and Physical Activity',
//           'Moving Well – Performing Competitive Athletics with Refined Technique',
//           'Understanding Movement – Understanding Basic Training Principles and Their Effects',
//           'Moving Creatively – Choreographing and Performing a Movement Sequence',
//           'Taking Part – Officiating and Leading in Sporting Activities',
//           'Taking Responsibility – Evaluating Personal Performance and Setting Improvement Goals',
//           'Healthy Bodies – Understanding the Long-Term Benefits of Regular Physical Activity',
//         ],
//       },
//       {
//         name: 'Wellbeing',
//         // Cambridge Primary Wellbeing (0034) – Stage 6
//         topics: [
//           'Understanding Myself – Managing Change and Transitions: Moving to Secondary School',
//           'Understanding Myself – Understanding How Emotions and Identity Develop Over Time',
//           'Understanding Myself – Reflecting on Personal Values and How They Guide Decisions',
//           'My Relationships – Developing Leadership and Collaboration Skills',
//           'My Relationships – Understanding Diversity and Its Importance in a Globalised World',
//           'My Relationships – Exploring Responsible Use of Social Media and Online Relationships',
//           'Navigating My World – Understanding Global Citizenship and Personal Responsibility',
//           'Navigating My World – Exploring Career Aspirations and Pathways for the Future',
//         ],
//       },
//       {
//         name: 'Modern Foreign Language',
//         // Cambridge Primary Modern Foreign Language (0064) – Stage 6
//         topics: [
//           'Listening – Understanding Short Simple General Statements in the Target Language',
//           'Listening – Identifying Main Points and Some Details in Short Audio Passages',
//           'Speaking – Using Phrases with Pauses to Communicate in the Target Language',
//           'Speaking – Initiating and Responding in Simple Conversations on Familiar Topics',
//           'Reading – Reading Short Simple Texts on General Topics with Some Unfamiliar Vocabulary',
//           'Writing – Writing Simple Phrases and Sentences with Support from a Dictionary',
//           'Vocabulary – Consolidating and Extending Vocabulary Across Core Topic Areas',
//           'Grammar – Applying Basic Grammar Rules: Gender, Plurals, Simple Tenses',
//           'Cultural Understanding – Applying Basic Cultural Customs Appropriately in Social Exchanges',
//         ],
//       },
//     ],
//   },

//   7: {
//     grade: 7,
//     cambridgeLevel: 'Lower Secondary Stage 7',
//     description: 'Cambridge Lower Secondary – Stage 7 (ages 11–12)',
//     subjects: [
//       {
//         name: 'Mathematics',
//         topics: [
//           'Number – Integers, Factors and Multiples',
//           'Number – Decimals, Fractions and Percentages',
//           'Number – Ratio and Proportion',
//           'Number – Powers, Roots and Standard Form',
//           'Algebra – Expressions and Simplification',
//           'Algebra – Linear Equations and Inequalities',
//           'Algebra – Sequences and Patterns',
//           'Geometry – Angles and Lines',
//           'Geometry – Triangles and Quadrilaterals',
//           'Geometry – Circles and Polygons',
//           'Geometry – Coordinates and Transformations',
//           'Mensuration – Perimeter, Area and Volume',
//           'Statistics – Data Collection and Representation',
//           'Statistics – Averages and Range',
//           'Probability – Basic Probability Concepts',
//         ],
//       },
//       {
//         name: 'Science',
//         topics: [
//           'Biology – Characteristics of Living Things',
//           'Biology – Cells: Structure and Function',
//           'Biology – Plant and Animal Nutrition',
//           'Biology – Respiration and Gas Exchange',
//           'Biology – Ecosystems and Food Webs',
//           'Chemistry – States of Matter and Particle Model',
//           'Chemistry – Elements, Compounds and Mixtures',
//           'Chemistry – Chemical vs Physical Changes',
//           'Chemistry – Acids, Alkalis and Indicators',
//           'Physics – Forces and Motion',
//           'Physics – Speed, Distance and Time',
//           'Physics – Energy: Types and Transfers',
//           'Physics – Electricity and Simple Circuits',
//           'Physics – Light and Sound Waves',
//           'Physics – Magnetism',
//         ],
//       },
//       {
//         name: 'English Language',
//         topics: [
//           'Reading – Comprehension and Inference',
//           'Reading – Purpose, Audience and Effect',
//           'Writing – Narrative and Descriptive Writing',
//           'Writing – Informative and Argumentative Writing',
//           'Grammar – Sentence Structure and Punctuation',
//           'Grammar – Tenses and Parts of Speech',
//           'Vocabulary – Word Meaning in Context',
//           'Speaking and Listening – Presentation Skills',
//         ],
//       },
//     ],
//   },

//   8: {
//     grade: 8,
//     cambridgeLevel: 'Lower Secondary Stage 8',
//     description: 'Cambridge Lower Secondary – Stage 8 (ages 12–13)',
//     subjects: [
//       {
//         name: 'Mathematics',
//         topics: [
//           'Number – Rational and Irrational Numbers',
//           'Number – Percentages, Profit and Loss',
//           'Number – Standard Form and Estimation',
//           'Algebra – Expanding and Factorising Expressions',
//           'Algebra – Simultaneous Linear Equations',
//           'Algebra – Quadratic Expressions',
//           'Algebra – Graphs of Linear and Quadratic Functions',
//           'Geometry – Congruence and Similarity',
//           'Geometry – Pythagoras Theorem',
//           'Geometry – Circles: Arc, Sector and Chord',
//           'Trigonometry – Sine, Cosine and Tangent in Right Triangles',
//           'Mensuration – Surface Area and Volume of 3D Shapes',
//           'Statistics – Pie Charts, Bar Charts and Histograms',
//           'Statistics – Mean, Median, Mode and Range',
//           'Probability – Probability Scale and Simple Events',
//         ],
//       },
//       {
//         name: 'Science',
//         topics: [
//           'Biology – Reproduction in Plants and Animals',
//           'Biology – Genetics and Inheritance',
//           'Biology – Human Body Systems',
//           'Biology – Microorganisms and Disease',
//           'Chemistry – Atomic Structure and the Periodic Table',
//           'Chemistry – Chemical Reactions and Equations',
//           'Chemistry – Metals and Non-Metals',
//           'Chemistry – Rates of Chemical Reactions',
//           'Physics – Pressure in Fluids',
//           'Physics – Density and Floating/Sinking',
//           'Physics – Thermal Energy and Heat Transfer',
//           'Physics – Electromagnetic Spectrum',
//           'Physics – Earth and Space',
//           'Physics – Newton\'s Laws of Motion',
//         ],
//       },
//       {
//         name: 'English Language',
//         topics: [
//           'Reading – Analysing Language and Structure',
//           'Reading – Comparing Texts',
//           'Writing – Persuasive and Discursive Writing',
//           'Writing – Report and Summary Writing',
//           'Grammar – Complex Sentences and Clauses',
//           'Grammar – Active and Passive Voice',
//           'Vocabulary – Synonyms, Antonyms and Connotations',
//           'Literature – Introduction to Poetry and Prose',
//         ],
//       },
//     ],
//   },

//   9: {
//     grade: 9,
//     cambridgeLevel: 'Lower Secondary Stage 9',
//     description: 'Cambridge Lower Secondary – Stage 9 / IGCSE Entry (ages 13–14)',
//     subjects: [
//       {
//         name: 'Mathematics',
//         topics: [
//           'Number – Surds and Further Indices',
//           'Algebra – Functions and Inverse Functions',
//           'Algebra – Inequalities and Regions',
//           'Algebra – Algebraic Fractions',
//           'Geometry – Vectors',
//           'Geometry – Circle Theorems',
//           'Trigonometry – Sine Rule and Cosine Rule',
//           'Trigonometry – Trigonometric Graphs',
//           'Matrices – Introduction and Multiplication',
//           'Mensuration – Further Area and Volume',
//           'Statistics – Cumulative Frequency and Box Plots',
//           'Statistics – Scatter Graphs and Correlation',
//           'Probability – Tree Diagrams and Combined Events',
//           'Probability – Conditional Probability',
//           'Sequences – nth Term of Arithmetic and Geometric Sequences',
//         ],
//       },
//       {
//         name: 'Science',
//         topics: [
//           'Biology – Photosynthesis and Plant Transport',
//           'Biology – Evolution and Natural Selection',
//           'Biology – Biodiversity and Conservation',
//           'Biology – Hormones and Homeostasis',
//           'Chemistry – Chemical Bonding (Ionic and Covalent)',
//           'Chemistry – Electrolysis',
//           'Chemistry – Organic Chemistry: Hydrocarbons',
//           'Chemistry – Acids, Bases and Salts',
//           'Physics – Waves: Properties and Behaviour',
//           'Physics – Nuclear Physics and Radioactivity',
//           'Physics – Electric Fields and Potential',
//           'Physics – Electromagnetic Induction',
//           'Physics – Space Physics',
//         ],
//       },
//       {
//         name: 'English Language',
//         topics: [
//           'Reading – Evaluating Writer\'s Perspective and Attitude',
//           'Reading – Non-Fiction and Media Texts',
//           'Writing – Directed Writing Tasks',
//           'Writing – Extended Creative Writing',
//           'Grammar – Advanced Punctuation and Style',
//           'Vocabulary – Figurative Language and Idioms',
//           'Literature – Short Stories and Drama',
//           'Speaking – Debate and Formal Discussion',
//         ],
//       },
//       {
//         name: 'Computer Science',
//         topics: [
//           'Problem Solving – Algorithms and Flowcharts',
//           'Programming – Variables, Data Types and Operators',
//           'Programming – Sequence, Selection and Iteration',
//           'Programming – Procedures and Functions',
//           'Data – Binary and Hexadecimal Numbers',
//           'Data – Data Storage and File Sizes',
//           'Networks – Introduction to Computer Networks',
//           'Systems – Hardware and Software Components',
//         ],
//       },
//     ],
//   },

//   // ── IGCSE (Years 10–11) ────────────────────────────────────────────────────
//   // IGCSE is a 2-year programme. Both Year 10 and Year 11 carry the full
//   // combined syllabus so students can be assessed on any topic at any point.
//   10: {
//     grade: 10,
//     cambridgeLevel: 'IGCSE Year 10',
//     description: 'Cambridge IGCSE – Year 10 (ages 14–15)',
//     subjects: [
//       {
//         name: 'Mathematics',
//         code: '0580',
//         topics: [
//           // Number
//           'Number – Number Types, HCF, LCM and Factors',
//           'Number – Fractions, Decimals, Percentages and Ratios',
//           'Number – Standard Form and Approximation',
//           'Number – Surds and Indices',
//           'Number – Bounds and Error Intervals',
//           // Algebra
//           'Algebra – Expressions: Expanding, Factorising, Simplifying',
//           'Algebra – Linear Equations and Inequalities',
//           'Algebra – Simultaneous Equations (Linear)',
//           'Algebra – Simultaneous Equations (One Linear, One Quadratic)',
//           'Algebra – Quadratic Equations: Factorisation and Formula',
//           'Algebra – Completing the Square',
//           'Algebra – Algebraic Fractions and Complex Manipulation',
//           'Algebra – Functions: Domain, Range and Inverse',
//           'Algebra – Sequences: Arithmetic and Geometric nth Terms',
//           // Coordinate Geometry
//           'Coordinate Geometry – Gradient, y-Intercept and Straight Lines',
//           'Coordinate Geometry – Distance and Midpoint',
//           'Coordinate Geometry – Equation of a Circle',
//           // Graphs
//           'Graphs – Linear, Quadratic, Cubic and Reciprocal Graphs',
//           'Graphs – Differentiation and Gradient of Curves',
//           'Graphs – Velocity–Time Graphs and Area Under Curve',
//           // Trigonometry
//           'Trigonometry – SOH-CAH-TOA in Right-Angled Triangles',
//           'Trigonometry – Sine Rule and Cosine Rule',
//           'Trigonometry – Trigonometric Graphs and Identities',
//           // Geometry
//           'Geometry – Angles in Polygons and Parallel Lines',
//           'Geometry – Congruence and Similarity',
//           'Geometry – Circle Theorems',
//           'Geometry – Constructions and Loci',
//           'Geometry – Vectors: Addition, Subtraction and Scalar Multiplication',
//           'Geometry – Transformations: Translation, Reflection, Rotation, Enlargement',
//           // Matrices
//           'Matrices – Matrix Multiplication and Transformations',
//           // Mensuration
//           'Mensuration – Perimeter, Area of 2D Shapes',
//           'Mensuration – Volume and Surface Area of 3D Shapes',
//           'Mensuration – Arc Length and Sector Area',
//           // Statistics
//           'Statistics – Statistical Diagrams: Bar, Pie, Histograms',
//           'Statistics – Averages: Mean, Median, Mode, Range',
//           'Statistics – Cumulative Frequency and Quartiles',
//           'Statistics – Histograms with Unequal Class Widths',
//           // Probability
//           'Probability – Single and Combined Events',
//           'Probability – Conditional Probability and Tree Diagrams',
//           'Probability – Mutually Exclusive and Independent Events',
//           // Exam skills
//           'Exam Preparation – Past Paper Techniques and Problem Solving',
//         ],
//       },
//       {
//         name: 'Physics',
//         code: '0625',
//         topics: [
//           // General Physics
//           'General Physics – Measurement and Units',
//           'General Physics – Scalars and Vectors',
//           'General Physics – Speed, Velocity and Acceleration',
//           'General Physics – Distance–Time and Velocity–Time Graphs',
//           'General Physics – Forces: Resultant, Friction, Weight',
//           'General Physics – Newton\'s Laws of Motion',
//           'General Physics – Momentum and Impulse',
//           'General Physics – Work, Energy and Power',
//           'General Physics – Efficiency and Energy Resources',
//           'General Physics – Pressure in Solids, Liquids and Gases',
//           'General Physics – Moments and Centre of Gravity',
//           'General Physics – Circular Motion',
//           // Thermal Physics
//           'Thermal Physics – States of Matter and Changes of State',
//           'Thermal Physics – Thermal Expansion',
//           'Thermal Physics – Conduction, Convection and Radiation',
//           // Waves
//           'Waves – Properties: Frequency, Wavelength, Amplitude',
//           'Waves – Reflection, Refraction and Diffraction of Light',
//           'Waves – Electromagnetic Spectrum',
//           'Waves – Sound: Speed, Echoes and Ultrasound',
//           'Waves – Total Internal Reflection and Optical Fibres',
//           'Waves – Refraction and Snell\'s Law',
//           // Electricity
//           'Electricity – Static Electricity and Electric Fields',
//           'Electricity – Current, Voltage and Resistance',
//           'Electricity – Series and Parallel Circuits',
//           'Electricity – Electrical Power and Energy',
//           'Electricity – Magnetism and Magnetic Fields',
//           'Electricity – Transformers and National Grid',
//           'Electricity – Logic Gates and Electronic Systems',
//           // Magnetism
//           'Magnetism – Electromagnetism and Solenoids',
//           'Magnetism – Electromagnetic Induction and Generators',
//           // Atomic Physics
//           'Atomic Physics – Radioactivity: Alpha, Beta, Gamma',
//           'Atomic Physics – Half-Life and Radioactive Decay',
//           'Atomic Physics – Nuclear Fission and Fusion',
//           // Space Physics
//           'Space Physics – Solar System and Satellites',
//           'Space Physics – Stars and the Universe',
//           // Exam skills
//           'Exam Preparation – Structured and Multiple Choice Techniques',
//         ],
//       },
//       {
//         name: 'Chemistry',
//         code: '0620',
//         topics: [
//           // Experimental Techniques
//           'Experimental Techniques – Filtration, Distillation, Chromatography',
//           // Matter
//           'Matter – Particle Model of Matter',
//           'Matter – Atomic Structure: Protons, Neutrons, Electrons',
//           'Matter – Isotopes and Relative Atomic Mass',
//           // Bonding
//           'Bonding – Ionic Bonding and Properties of Ionic Compounds',
//           'Bonding – Covalent Bonding and Properties',
//           'Bonding – Metallic Bonding',
//           // Stoichiometry
//           'Stoichiometry – Moles, Molar Mass and Formulae',
//           'Stoichiometry – Writing and Balancing Equations',
//           'Stoichiometry – Concentration and Titration Calculations',
//           // Periodic Table
//           'Periodic Table – Groups and Periods',
//           'Periodic Table – Properties of Group 1 and Group 7',
//           'Periodic Table – Transition Metals',
//           'Periodic Table – Group 0 Noble Gases',
//           // Reactions
//           'Reactions – Types of Chemical Reactions',
//           'Reactions – Reactivity Series of Metals',
//           'Reactions – Acids, Bases and Neutralisation',
//           'Reactions – Salts: Preparation and Properties',
//           'Reactions – Rates of Reaction',
//           'Reactions – Equilibrium and Le Chatelier\'s Principle',
//           'Reactions – Haber Process and Contact Process',
//           // Electrochemistry
//           'Electrochemistry – Electrolysis Principles',
//           'Electrochemistry – Industrial Electrolysis (Brine, Bauxite)',
//           // Energetics
//           'Energetics – Exothermic and Endothermic Reactions',
//           'Energetics – Bond Energies and Hess\'s Law',
//           // Organic Chemistry
//           'Organic Chemistry – Alkanes and Alkenes',
//           'Organic Chemistry – Alcohols, Carboxylic Acids and Esters',
//           'Organic Chemistry – Polymers: Addition and Condensation',
//           'Organic Chemistry – Combustion and Cracking of Hydrocarbons',
//           // Air and Water
//           'Air and Water – Composition of Air and Pollution',
//           'Air and Water – Water Treatment and Hardness',
//           // Exam skills
//           'Exam Preparation – Practical Chemistry and Data Analysis',
//         ],
//       },
//       {
//         name: 'Biology',
//         code: '0610',
//         topics: [
//           // Cells
//           'Cells – Cell Structure: Animal and Plant',
//           'Cells – Diffusion, Osmosis and Active Transport',
//           // Biological Molecules
//           'Biological Molecules – Carbohydrates, Proteins and Fats',
//           'Biological Molecules – Enzymes and their Actions',
//           // Plant Nutrition
//           'Plant Nutrition – Photosynthesis',
//           // Animal Nutrition
//           'Animal Nutrition – Human Digestive System',
//           'Animal Nutrition – Balanced Diet',
//           // Transport
//           'Transport in Plants – Xylem, Phloem, Transpiration',
//           'Transport in Animals – Blood and Circulatory System',
//           // Gas Exchange and Respiration
//           'Gas Exchange – Human Breathing System',
//           'Respiration – Aerobic and Anaerobic Respiration',
//           // Disease and Immunity
//           'Disease – Pathogens and Transmission',
//           'Immunity – Immune Response and Vaccines',
//           // Excretion and Coordination
//           'Excretion – The Kidney and Urea Formation',
//           'Coordination – The Nervous System',
//           'Coordination – Hormones: Insulin, ADH and Adrenaline',
//           // Reproduction
//           'Reproduction – Human Reproductive System',
//           'Reproduction – Fertilisation and Development',
//           'Reproduction – Asexual and Sexual Reproduction in Plants',
//           // Inheritance
//           'Inheritance – Chromosomes, Genes and Alleles',
//           'Inheritance – Mendelian Genetics and Monohybrid Crosses',
//           'Inheritance – Sex Determination and Sex-Linked Traits',
//           // Variation and Selection
//           'Variation and Selection – Natural Selection and Evolution',
//           'Variation and Selection – Mutations and Genetic Variation',
//           // Ecology
//           'Ecology – Populations, Competition and Food Chains',
//           'Ecology – Carbon Cycle and Nitrogen Cycle',
//           'Ecology – Human Impact on the Environment',
//           // Biotechnology
//           'Biotechnology – Genetic Engineering Basics',
//           // Exam skills
//           'Exam Preparation – Practical Investigations and Data Handling',
//         ],
//       },
//       {
//         name: 'English Language',
//         code: '0500',
//         topics: [
//           // Reading
//           'Reading – Comprehension: Explicit and Implicit Information',
//           'Reading – Writer\'s Techniques: Language and Structure',
//           'Reading – Summary Writing',
//           'Reading – Extended Inference and Evaluation',
//           'Reading – Comparing Writer\'s Viewpoints',
//           'Reading – Selecting and Re-ordering Information',
//           // Writing
//           'Writing – Narrative and Descriptive Compositions',
//           'Writing – Argumentative and Persuasive Essays',
//           'Writing – Directed Writing (Letters, Reports, Articles)',
//           'Writing – Crafting Effective Openings and Endings',
//           'Writing – Tone, Register and Audience Adaptation',
//           'Writing – Exam-Focused Essay Practice',
//           // Grammar and Vocabulary
//           'Grammar – Sentence Variety and Accuracy',
//           'Grammar – Sophisticated Sentence Structures',
//           'Vocabulary – Precise Word Choice and Register',
//           'Vocabulary – Technical and Formal Language',
//           // Exam skills
//           'Exam Skills – Time Management and Planning',
//         ],
//       },
//       {
//         name: 'Computer Science',
//         code: '0478',
//         topics: [
//           // Data Representation
//           'Data Representation – Binary, Denary and Hexadecimal',
//           'Data Representation – Data Storage: Images, Sound, Text',
//           // Problem Solving
//           'Problem Solving – Algorithms and Pseudocode',
//           'Problem Solving – Flowcharts and Trace Tables',
//           // Programming
//           'Programming – Variables, Data Types and Assignment',
//           'Programming – Selection: IF, ELSE, CASE',
//           'Programming – Iteration: WHILE, FOR, REPEAT',
//           'Programming – Procedures and Functions',
//           'Programming – Arrays',
//           'Programming – File Handling',
//           'Programming – Exception Handling',
//           'Programming – Searching Algorithms (Linear, Binary)',
//           'Programming – Sorting Algorithms (Bubble, Merge, Insertion)',
//           'Programming – Recursion',
//           // Data Structures
//           'Data Structures – Stacks, Queues and Linked Lists',
//           // Systems
//           'Systems – Hardware: CPU, Memory, Storage',
//           'Systems – Input and Output Devices',
//           'Systems – Operating Systems and Software',
//           'Systems – System Life Cycle and Software Development',
//           // Networks
//           'Networks – Network Topologies and Protocols',
//           'Networks – Internet, WWW and Security',
//           'Networks – Cybersecurity and Encryption',
//           // Ethics
//           'Ethics – Digital Citizenship and Data Privacy',
//           // Exam skills
//           'Exam Preparation – Program Traces and Algorithm Design',
//         ],
//       },
//       {
//         name: 'Economics',
//         code: '0455',
//         topics: [
//           'The Basic Economic Problem – Scarcity and Choice',
//           'The Basic Economic Problem – Opportunity Cost and Production Possibility Curves',
//           'Microeconomics – Demand: Law and Determinants',
//           'Microeconomics – Supply: Law and Determinants',
//           'Microeconomics – Price Equilibrium and Market Mechanism',
//           'Microeconomics – Elasticity of Demand and Supply',
//           'Microeconomics – Market Failure and Externalities',
//           'Business Economics – Costs, Revenue and Profit',
//           'Business Economics – Market Structures',
//           'Macroeconomics – Economic Growth and GDP',
//           'Macroeconomics – Inflation: Causes, Effects and Control',
//           'Macroeconomics – Unemployment: Causes and Policies',
//           'Macroeconomics – Balance of Payments',
//           'International Trade – Comparative Advantage and Free Trade',
//           'International Trade – Protectionism: Tariffs, Quotas, Subsidies',
//           'International Trade – Exchange Rates',
//           'Government Policies – Fiscal Policy: Taxation and Government Spending',
//           'Government Policies – Monetary Policy: Interest Rates and Money Supply',
//           'Government Policies – Supply-Side Policies',
//           'Exam Preparation – Data Response and Essay Techniques',
//         ],
//       },
//       {
//         name: 'Business Studies',
//         code: '0450',
//         topics: [
//           'Business Activity – Purpose and Types of Business',
//           'Business Activity – Stakeholders and Business Objectives',
//           'Business Activity – Business Growth and Size',
//           'People in Business – Organisational Structure and Communication',
//           'People in Business – Motivation Theories and Methods',
//           'People in Business – Leadership Styles',
//           'People in Business – Recruitment, Selection and Training',
//           'People in Business – Employment Law and Ethics',
//           'Marketing – Market Research: Methods and Analysis',
//           'Marketing – Market Segmentation and Targeting',
//           'Marketing – Marketing Mix: Product, Price, Place, Promotion',
//           'Marketing – E-Commerce and Digital Marketing',
//           'Operations – Methods of Production',
//           'Operations – Quality Assurance and Control',
//           'Operations – Capacity Utilisation and Lean Production',
//           'Operations – Supply Chain and Location',
//           'Finance – Sources of Finance: Internal and External',
//           'Finance – Cash Flow Forecasting and Management',
//           'Finance – Income Statements and Balance Sheets',
//           'Finance – Ratio Analysis',
//           'External Influences – Economic Environment and Business Cycle',
//           'External Influences – Legal, Environmental and Ethical Issues',
//           'External Influences – Globalisation and Multinational Businesses',
//           'Exam Preparation – Case Study and Data Analysis Techniques',
//         ],
//       },
//     ],
//   },

//   11: {
//     grade: 11,
//     cambridgeLevel: 'IGCSE Year 11',
//     description: 'Cambridge IGCSE – Year 11 / Examination Year (ages 15–16)',
//     subjects: [
//       {
//         name: 'Mathematics',
//         code: '0580',
//         topics: [
//           // Number
//           'Number – Number Types, HCF, LCM and Factors',
//           'Number – Fractions, Decimals, Percentages and Ratios',
//           'Number – Standard Form and Approximation',
//           'Number – Surds and Indices',
//           'Number – Bounds and Error Intervals',
//           // Algebra
//           'Algebra – Expressions: Expanding, Factorising, Simplifying',
//           'Algebra – Linear Equations and Inequalities',
//           'Algebra – Simultaneous Equations (Linear)',
//           'Algebra – Simultaneous Equations (One Linear, One Quadratic)',
//           'Algebra – Quadratic Equations: Factorisation and Formula',
//           'Algebra – Completing the Square',
//           'Algebra – Algebraic Fractions and Complex Manipulation',
//           'Algebra – Functions: Domain, Range and Inverse',
//           'Algebra – Sequences: Arithmetic and Geometric nth Terms',
//           // Coordinate Geometry
//           'Coordinate Geometry – Gradient, y-Intercept and Straight Lines',
//           'Coordinate Geometry – Distance and Midpoint',
//           'Coordinate Geometry – Equation of a Circle',
//           // Graphs
//           'Graphs – Linear, Quadratic, Cubic and Reciprocal Graphs',
//           'Graphs – Differentiation and Gradient of Curves',
//           'Graphs – Velocity–Time Graphs and Area Under Curve',
//           // Trigonometry
//           'Trigonometry – SOH-CAH-TOA in Right-Angled Triangles',
//           'Trigonometry – Sine Rule and Cosine Rule',
//           'Trigonometry – Trigonometric Graphs and Identities',
//           // Geometry
//           'Geometry – Angles in Polygons and Parallel Lines',
//           'Geometry – Congruence and Similarity',
//           'Geometry – Circle Theorems',
//           'Geometry – Constructions and Loci',
//           'Geometry – Vectors: Addition, Subtraction and Scalar Multiplication',
//           'Geometry – Transformations: Translation, Reflection, Rotation, Enlargement',
//           // Matrices
//           'Matrices – Matrix Multiplication and Transformations',
//           // Mensuration
//           'Mensuration – Perimeter, Area of 2D Shapes',
//           'Mensuration – Volume and Surface Area of 3D Shapes',
//           'Mensuration – Arc Length and Sector Area',
//           // Statistics
//           'Statistics – Statistical Diagrams: Bar, Pie, Histograms',
//           'Statistics – Averages: Mean, Median, Mode, Range',
//           'Statistics – Cumulative Frequency and Quartiles',
//           'Statistics – Histograms with Unequal Class Widths',
//           // Probability
//           'Probability – Single and Combined Events',
//           'Probability – Conditional Probability and Tree Diagrams',
//           'Probability – Mutually Exclusive and Independent Events',
//           // Exam skills
//           'Exam Preparation – Past Paper Techniques and Problem Solving',
//         ],
//       },
//       {
//         name: 'Physics',
//         code: '0625',
//         topics: [
//           'General Physics – Measurement and Units',
//           'General Physics – Scalars and Vectors',
//           'General Physics – Speed, Velocity and Acceleration',
//           'General Physics – Distance–Time and Velocity–Time Graphs',
//           'General Physics – Forces: Resultant, Friction, Weight',
//           'General Physics – Newton\'s Laws of Motion',
//           'General Physics – Momentum and Impulse',
//           'General Physics – Work, Energy and Power',
//           'General Physics – Efficiency and Energy Resources',
//           'General Physics – Pressure in Solids, Liquids and Gases',
//           'General Physics – Moments and Centre of Gravity',
//           'General Physics – Circular Motion',
//           'Thermal Physics – States of Matter and Changes of State',
//           'Thermal Physics – Thermal Expansion',
//           'Thermal Physics – Conduction, Convection and Radiation',
//           'Waves – Properties: Frequency, Wavelength, Amplitude',
//           'Waves – Reflection, Refraction and Diffraction of Light',
//           'Waves – Electromagnetic Spectrum',
//           'Waves – Sound: Speed, Echoes and Ultrasound',
//           'Waves – Total Internal Reflection and Optical Fibres',
//           'Waves – Refraction and Snell\'s Law',
//           'Electricity – Static Electricity and Electric Fields',
//           'Electricity – Current, Voltage and Resistance',
//           'Electricity – Series and Parallel Circuits',
//           'Electricity – Electrical Power and Energy',
//           'Electricity – Magnetism and Magnetic Fields',
//           'Electricity – Transformers and National Grid',
//           'Electricity – Logic Gates and Electronic Systems',
//           'Magnetism – Electromagnetism and Solenoids',
//           'Magnetism – Electromagnetic Induction and Generators',
//           'Atomic Physics – Radioactivity: Alpha, Beta, Gamma',
//           'Atomic Physics – Half-Life and Radioactive Decay',
//           'Atomic Physics – Nuclear Fission and Fusion',
//           'Space Physics – Solar System and Satellites',
//           'Space Physics – Stars and the Universe',
//           'Exam Preparation – Structured and Multiple Choice Techniques',
//         ],
//       },
//       {
//         name: 'Chemistry',
//         code: '0620',
//         topics: [
//           'Experimental Techniques – Filtration, Distillation, Chromatography',
//           'Matter – Particle Model of Matter',
//           'Matter – Atomic Structure: Protons, Neutrons, Electrons',
//           'Matter – Isotopes and Relative Atomic Mass',
//           'Bonding – Ionic Bonding and Properties of Ionic Compounds',
//           'Bonding – Covalent Bonding and Properties',
//           'Bonding – Metallic Bonding',
//           'Stoichiometry – Moles, Molar Mass and Formulae',
//           'Stoichiometry – Writing and Balancing Equations',
//           'Stoichiometry – Concentration and Titration Calculations',
//           'Periodic Table – Groups and Periods',
//           'Periodic Table – Properties of Group 1 and Group 7',
//           'Periodic Table – Transition Metals',
//           'Periodic Table – Group 0 Noble Gases',
//           'Reactions – Types of Chemical Reactions',
//           'Reactions – Reactivity Series of Metals',
//           'Reactions – Acids, Bases and Neutralisation',
//           'Reactions – Salts: Preparation and Properties',
//           'Reactions – Rates of Reaction',
//           'Reactions – Equilibrium and Le Chatelier\'s Principle',
//           'Reactions – Haber Process and Contact Process',
//           'Electrochemistry – Electrolysis Principles',
//           'Electrochemistry – Industrial Electrolysis (Brine, Bauxite)',
//           'Energetics – Exothermic and Endothermic Reactions',
//           'Energetics – Bond Energies and Hess\'s Law',
//           'Organic Chemistry – Alkanes and Alkenes',
//           'Organic Chemistry – Alcohols, Carboxylic Acids and Esters',
//           'Organic Chemistry – Polymers: Addition and Condensation',
//           'Organic Chemistry – Combustion and Cracking of Hydrocarbons',
//           'Air and Water – Composition of Air and Pollution',
//           'Air and Water – Water Treatment and Hardness',
//           'Exam Preparation – Practical Chemistry and Data Analysis',
//         ],
//       },
//       {
//         name: 'Biology',
//         code: '0610',
//         topics: [
//           'Cells – Cell Structure: Animal and Plant',
//           'Cells – Diffusion, Osmosis and Active Transport',
//           'Biological Molecules – Carbohydrates, Proteins and Fats',
//           'Biological Molecules – Enzymes and their Actions',
//           'Plant Nutrition – Photosynthesis',
//           'Animal Nutrition – Human Digestive System',
//           'Animal Nutrition – Balanced Diet',
//           'Transport in Plants – Xylem, Phloem, Transpiration',
//           'Transport in Animals – Blood and Circulatory System',
//           'Gas Exchange – Human Breathing System',
//           'Respiration – Aerobic and Anaerobic Respiration',
//           'Disease – Pathogens and Transmission',
//           'Immunity – Immune Response and Vaccines',
//           'Excretion – The Kidney and Urea Formation',
//           'Coordination – The Nervous System',
//           'Coordination – Hormones: Insulin, ADH and Adrenaline',
//           'Reproduction – Human Reproductive System',
//           'Reproduction – Fertilisation and Development',
//           'Reproduction – Asexual and Sexual Reproduction in Plants',
//           'Inheritance – Chromosomes, Genes and Alleles',
//           'Inheritance – Mendelian Genetics and Monohybrid Crosses',
//           'Inheritance – Sex Determination and Sex-Linked Traits',
//           'Variation and Selection – Natural Selection and Evolution',
//           'Variation and Selection – Mutations and Genetic Variation',
//           'Ecology – Populations, Competition and Food Chains',
//           'Ecology – Carbon Cycle and Nitrogen Cycle',
//           'Ecology – Human Impact on the Environment',
//           'Biotechnology – Genetic Engineering Basics',
//           'Exam Preparation – Practical Investigations and Data Handling',
//         ],
//       },
//       {
//         name: 'English Language',
//         code: '0500',
//         topics: [
//           'Reading – Comprehension: Explicit and Implicit Information',
//           'Reading – Writer\'s Techniques: Language and Structure',
//           'Reading – Summary Writing',
//           'Reading – Extended Inference and Evaluation',
//           'Reading – Comparing Writer\'s Viewpoints',
//           'Reading – Selecting and Re-ordering Information',
//           'Writing – Narrative and Descriptive Compositions',
//           'Writing – Argumentative and Persuasive Essays',
//           'Writing – Directed Writing (Letters, Reports, Articles)',
//           'Writing – Crafting Effective Openings and Endings',
//           'Writing – Tone, Register and Audience Adaptation',
//           'Writing – Exam-Focused Essay Practice',
//           'Grammar – Sentence Variety and Accuracy',
//           'Grammar – Sophisticated Sentence Structures',
//           'Vocabulary – Precise Word Choice and Register',
//           'Vocabulary – Technical and Formal Language',
//           'Exam Skills – Time Management and Planning',
//         ],
//       },
//       {
//         name: 'Computer Science',
//         code: '0478',
//         topics: [
//           'Data Representation – Binary, Denary and Hexadecimal',
//           'Data Representation – Data Storage: Images, Sound, Text',
//           'Problem Solving – Algorithms and Pseudocode',
//           'Problem Solving – Flowcharts and Trace Tables',
//           'Programming – Variables, Data Types and Assignment',
//           'Programming – Selection: IF, ELSE, CASE',
//           'Programming – Iteration: WHILE, FOR, REPEAT',
//           'Programming – Procedures and Functions',
//           'Programming – Arrays',
//           'Programming – File Handling',
//           'Programming – Exception Handling',
//           'Programming – Searching Algorithms (Linear, Binary)',
//           'Programming – Sorting Algorithms (Bubble, Merge, Insertion)',
//           'Programming – Recursion',
//           'Data Structures – Stacks, Queues and Linked Lists',
//           'Systems – Hardware: CPU, Memory, Storage',
//           'Systems – Input and Output Devices',
//           'Systems – Operating Systems and Software',
//           'Systems – System Life Cycle and Software Development',
//           'Networks – Network Topologies and Protocols',
//           'Networks – Internet, WWW and Security',
//           'Networks – Cybersecurity and Encryption',
//           'Ethics – Digital Citizenship and Data Privacy',
//           'Exam Preparation – Program Traces and Algorithm Design',
//         ],
//       },
//       {
//         name: 'Economics',
//         code: '0455',
//         topics: [
//           'The Basic Economic Problem – Scarcity and Choice',
//           'The Basic Economic Problem – Opportunity Cost and Production Possibility Curves',
//           'Microeconomics – Demand: Law and Determinants',
//           'Microeconomics – Supply: Law and Determinants',
//           'Microeconomics – Price Equilibrium and Market Mechanism',
//           'Microeconomics – Elasticity of Demand and Supply',
//           'Microeconomics – Market Failure and Externalities',
//           'Business Economics – Costs, Revenue and Profit',
//           'Business Economics – Market Structures',
//           'Macroeconomics – Economic Growth and GDP',
//           'Macroeconomics – Inflation: Causes, Effects and Control',
//           'Macroeconomics – Unemployment: Causes and Policies',
//           'Macroeconomics – Balance of Payments',
//           'International Trade – Comparative Advantage and Free Trade',
//           'International Trade – Protectionism: Tariffs, Quotas, Subsidies',
//           'International Trade – Exchange Rates',
//           'Government Policies – Fiscal Policy: Taxation and Government Spending',
//           'Government Policies – Monetary Policy: Interest Rates and Money Supply',
//           'Government Policies – Supply-Side Policies',
//           'Exam Preparation – Data Response and Essay Techniques',
//         ],
//       },
//       {
//         name: 'Business Studies',
//         code: '0450',
//         topics: [
//           'Business Activity – Purpose and Types of Business',
//           'Business Activity – Stakeholders and Business Objectives',
//           'Business Activity – Business Growth and Size',
//           'People in Business – Organisational Structure and Communication',
//           'People in Business – Motivation Theories and Methods',
//           'People in Business – Leadership Styles',
//           'People in Business – Recruitment, Selection and Training',
//           'People in Business – Employment Law and Ethics',
//           'Marketing – Market Research: Methods and Analysis',
//           'Marketing – Market Segmentation and Targeting',
//           'Marketing – Marketing Mix: Product, Price, Place, Promotion',
//           'Marketing – E-Commerce and Digital Marketing',
//           'Operations – Methods of Production',
//           'Operations – Quality Assurance and Control',
//           'Operations – Capacity Utilisation and Lean Production',
//           'Operations – Supply Chain and Location',
//           'Finance – Sources of Finance: Internal and External',
//           'Finance – Cash Flow Forecasting and Management',
//           'Finance – Income Statements and Balance Sheets',
//           'Finance – Ratio Analysis',
//           'External Influences – Economic Environment and Business Cycle',
//           'External Influences – Legal, Environmental and Ethical Issues',
//           'External Influences – Globalisation and Multinational Businesses',
//           'Exam Preparation – Case Study and Data Analysis Techniques',
//         ],
//       },
//     ],
//   },

//   12: {
//     grade: 12,
//     cambridgeLevel: 'Cambridge AS Level',
//     description: 'Cambridge International AS Level – Year 12 (ages 16–17)',
//     subjects: [
//       {
//         name: 'Mathematics',
//         code: '9709',
//         topics: [
//           'Pure 1 – Quadratics: Completing the Square and Discriminant',
//           'Pure 1 – Functions: Domain, Range, Inverse and Composite',
//           'Pure 1 – Coordinate Geometry: Lines and Circles',
//           'Pure 1 – Circular Measure: Radians, Arc Length and Sector Area',
//           'Pure 1 – Trigonometry: Identities and Equations',
//           'Pure 1 – Binomial Expansion',
//           'Pure 1 – Differentiation: Product, Quotient and Chain Rules',
//           'Pure 1 – Applications of Differentiation: Maxima and Minima',
//           'Pure 1 – Integration: Indefinite and Definite Integrals',
//           'Pure 1 – Integration: Area Under a Curve',
//           'Pure 1 – Vectors: Magnitude, Direction and Applications',
//           'Statistics 1 – Probability: Permutations and Combinations',
//           'Statistics 1 – Probability Distributions: Binomial and Normal',
//           'Statistics 1 – Statistical Hypothesis Testing',
//           'Statistics 1 – Representation of Data: Stem-and-Leaf, Box Plots',
//           'Mechanics 1 – Kinematics: Constant Acceleration Equations',
//           'Mechanics 1 – Forces and Newton\'s Laws in 2D',
//           'Mechanics 1 – Work, Energy, Power and Momentum',
//           'Mechanics 1 – Friction and Equilibrium',
//         ],
//       },
//       {
//         name: 'Physics',
//         code: '9702',
//         topics: [
//           'Physical Quantities – SI Units and Dimensional Analysis',
//           'Physical Quantities – Scalars, Vectors and Uncertainty',
//           'Kinematics – Equations of Motion and Projectile Motion',
//           'Dynamics – Newton\'s Laws and Free Body Diagrams',
//           'Dynamics – Momentum: Conservation and Collisions',
//           'Forces – Equilibrium, Moments and Torque',
//           'Work, Energy and Power – Conservation of Energy',
//           'Deformation of Solids – Hooke\'s Law, Stress, Strain and Young Modulus',
//           'Waves – Progressive Waves: Speed, Frequency, Wavelength',
//           'Waves – Superposition, Interference and Diffraction',
//           'Waves – Stationary Waves',
//           'Electricity – Charge, Current and Kirchhoff\'s Laws',
//           'Electricity – Resistance and Resistivity',
//           'Electricity – EMF, Internal Resistance and Potential Dividers',
//           'Particle Physics – Atomic Structure and Nuclear Equations',
//           'Particle Physics – Photoelectric Effect and Photons',
//           'Particle Physics – Energy Levels and Emission/Absorption Spectra',
//         ],
//       },
//       {
//         name: 'Chemistry',
//         code: '9701',
//         topics: [
//           'Atomic Structure – Atomic Orbitals and Electronic Configuration',
//           'Atomic Structure – Ionisation Energy and Trends',
//           'Bonding – Shapes of Molecules (VSEPR Theory)',
//           'Bonding – Bond Polarity and Intermolecular Forces',
//           'States of Matter – Ideal Gas Law and Gas Calculations',
//           'Stoichiometry – Moles, Yield and Atom Economy',
//           'Energetics – Enthalpy Changes and Hess\'s Law',
//           'Energetics – Bond Enthalpies',
//           'Electrochemistry – Standard Electrode Potentials',
//           'Equilibria – Equilibrium Constant Kc and Kp',
//           'Equilibria – Effect of Conditions on Equilibrium',
//           'Reaction Kinetics – Rate Equations and Activation Energy',
//           'Reaction Kinetics – Arrhenius Equation',
//           'Periodic Table – Periodicity of Properties',
//           'Group 2 – Reactions of Group 2 Metals and Compounds',
//           'Group 17 – Reactions and Uses of Halogens',
//           'Organic Chemistry – Nomenclature and Isomerism',
//           'Organic Chemistry – Alkanes and Haloalkanes',
//           'Organic Chemistry – Alkenes: Electrophilic Addition',
//           'Organic Chemistry – Alcohols and Carbonyl Compounds',
//         ],
//       },
//       {
//         name: 'Biology',
//         code: '9700',
//         topics: [
//           'Cell Structure – Ultrastructure of Cells and Organelles',
//           'Cell Structure – Cell Membranes: Fluid Mosaic Model',
//           'Cell Structure – Transport: Diffusion, Osmosis, Active Transport',
//           'Biological Molecules – Water, Carbohydrates, Proteins and Lipids',
//           'Biological Molecules – DNA Structure and the Genetic Code',
//           'Biological Molecules – ATP and Energy Currency',
//           'Enzymes – Enzyme Kinetics and Inhibition',
//           'Cell Division – Mitosis and the Cell Cycle',
//           'Cell Division – Meiosis and Genetic Variation',
//           'Transport in Plants – Xylem, Phloem and Translocation',
//           'Transport in Mammals – Blood, Heart and Circulatory System',
//           'Transport in Mammals – Haemoglobin and Oxygen Dissociation Curves',
//           'Immunity – Pathogens, Immune Response and Vaccines',
//           'Immunity – Antibodies and Monoclonal Antibodies',
//           'Gas Exchange – Pulmonary Ventilation and Gas Exchange in Alveoli',
//           'Protein Synthesis – Transcription and Translation',
//           'Protein Synthesis – Gene Expression and Mutations',
//           'Ecology – Population Size, Sampling Techniques',
//           'Ecology – Energy Flow and Trophic Levels',
//         ],
//       },
//       {
//         name: 'English Language',
//         code: '9093',
//         topics: [
//           'Reading – Analysing Argument and Persuasion',
//           'Reading – Evaluating Writer\'s Use of Language',
//           'Reading – Understanding Purpose and Audience in Non-Fiction',
//           'Writing – Crafting Argumentative and Analytical Essays',
//           'Writing – Directed Writing: Letters, Speeches, Articles, Reports',
//           'Writing – Creative and Imaginative Writing',
//           'Coursework – Extended Essay Planning and Drafting',
//           'Grammar – Stylistic Choices and Effect',
//           'Vocabulary – Academic and Formal Register',
//           'Exam Skills – Reading Under Timed Conditions',
//         ],
//       },
//       {
//         name: 'Computer Science',
//         code: '9608',
//         topics: [
//           'Information Representation – Number Systems and Character Encoding',
//           'Communication – Network Protocols (TCP/IP, HTTP, FTP)',
//           'Hardware – Processor Architecture and Instruction Set',
//           'Hardware – Memory: RAM, ROM, Cache and Virtual Memory',
//           'Software – Operating Systems: Memory Management and Scheduling',
//           'Programming – OOP: Classes, Objects, Inheritance, Polymorphism',
//           'Programming – Recursion and Recursive Algorithms',
//           'Programming – Algorithm Complexity (Big O Notation)',
//           'Data Structures – Arrays, Linked Lists, Stacks, Queues',
//           'Data Structures – Trees, Binary Search Trees and Graphs',
//           'Algorithms – Sorting: Quicksort, Mergesort',
//           'Algorithms – Searching: Binary Search and Hashing',
//           'Databases – Relational Databases and SQL',
//           'Databases – Entity-Relationship Diagrams',
//           'System Development – Software Development Life Cycle',
//           'Security – Encryption, Hashing and Cybersecurity Threats',
//         ],
//       },
//       {
//         name: 'Economics',
//         code: '9708',
//         topics: [
//           'Microeconomics – Consumer Theory: Utility and Demand',
//           'Microeconomics – Producer Theory: Costs and Revenue',
//           'Microeconomics – Market Structures: Perfect Competition, Monopoly, Oligopoly',
//           'Microeconomics – Market Failure: Externalities and Public Goods',
//           'Microeconomics – Government Intervention: Taxes, Subsidies and Price Controls',
//           'Macroeconomics – National Income: GDP, GNI and Economic Growth',
//           'Macroeconomics – Aggregate Demand and Aggregate Supply',
//           'Macroeconomics – Inflation: Causes and Consequences',
//           'Macroeconomics – Unemployment: Types and Policies',
//           'Macroeconomics – Fiscal Policy',
//           'Macroeconomics – Monetary Policy and Interest Rates',
//           'International Economics – Comparative Advantage and Free Trade',
//           'International Economics – Balance of Payments',
//           'International Economics – Exchange Rates',
//           'Development Economics – Economic Development Indicators',
//         ],
//       },
//     ],
//   },
// }

// /** Get subjects for a given Cambridge grade */
// export function getCambridgeSubjectsForGrade(grade: CambridgeGrade): string[] {
//   return CAMBRIDGE_CURRICULUM[grade].subjects.map((s) => s.name)
// }

// /** Get topics for a given Cambridge grade and subject */
// export function getCambridgeTopicsForGradeAndSubject(
//   grade: CambridgeGrade,
//   subjectName: string
// ): string[] {
//   const curriculum = CAMBRIDGE_CURRICULUM[grade]
//   const subject = curriculum.subjects.find((s) => s.name === subjectName)
//   return subject?.topics ?? []
// }

// /** Get Cambridge level label for a grade */
// export function getCambridgeLevelLabel(grade: CambridgeGrade): string {
//   return CAMBRIDGE_CURRICULUM[grade].cambridgeLevel
// }

// /** Get curriculum context string for AI prompt */
// export function getCambridgeCurriculumContext(
//   grade: CambridgeGrade,
//   subjectName: string,
//   selectedTopics: string[]
// ): string {
//   const gradeInfo = CAMBRIDGE_CURRICULUM[grade]
//   const subject = gradeInfo.subjects.find((s) => s.name === subjectName)
//   const codeStr = subject?.code ? ` (Syllabus ${subject.code})` : ''
//   return `**Curriculum Authority:** Cambridge Assessment International Education (CAIE)
// **Level:** ${gradeInfo.cambridgeLevel} – ${gradeInfo.description}
// **Subject:** ${subjectName}${codeStr}
// **Topics from Cambridge Syllabus:** ${selectedTopics.join(', ')}

// The questions MUST strictly align with the Cambridge International curriculum as prescribed by CAIE. Questions should:
// - Reflect the cognitive demands appropriate for ${gradeInfo.cambridgeLevel} students
// - Use Cambridge-style command words (describe, explain, evaluate, calculate, suggest, compare)
// - Be exam-ready for Cambridge International examinations${grade <= 6 ? ' (Primary)' : grade <= 9 ? ' (Lower Secondary)' : grade <= 11 ? ' (IGCSE)' : ' (AS Level)'}
// - Include recall, application and higher-order thinking questions as per Cambridge mark schemes`
// }
