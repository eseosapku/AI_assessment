# -*- coding: utf-8 -*-
"""
Builds the updated rwanda-curriculum.ts with real REB textbook units for P1-P6.
Preserves the existing S1-S6 (secondary) data.
"""
import re

ORIGINAL = r'c:\Users\MSI\AI_Assessment\lib\rwanda-curriculum.ts'

# Read original to extract everything from grade 7 onwards
with open(ORIGINAL, encoding='utf-8') as f:
    original = f.read()

# Find the start of grade 7 section
grade7_start = original.index('\n  7: {')
secondary_block = original[grade7_start:]  # includes '\n  7: {' ... to end

header = '''/**
 * Rwanda National Curriculum (REB - Rwanda Education Board)
 * Competence-Based Curriculum — 2025 Edition
 * Source: REB Revised Pupil\'s Books 2025-2026
 *
 * Primary: P1=Grade 1, P2=Grade 2, P3=Grade 3, P4=Grade 4, P5=Grade 5, P6=Grade 6
 * Lower Secondary: S1=Grade 7, S2=Grade 8, S3=Grade 9
 * Upper Secondary: S4=Grade 10, S5=Grade 11, S6=Grade 12
 */

export type GradeLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export interface CurriculumSubject {
  name: string
  level: \'core\' | \'elective\' | \'compulsory\'
  topics: string[]
}

export interface GradeCurriculum {
  grade: GradeLevel
  rwandaLevel: string
  description: string
  subjects: CurriculumSubject[]
}

export const RWANDAN_CURRICULUM: Record<GradeLevel, GradeCurriculum> = {
'''

p1_6_block = '''  1: {
    grade: 1,
    rwandaLevel: \'P1\',
    description: \'Primary One – Lower Primary Education (ages 6–7)\',
    subjects: [
      {
        name: \'Mathematics\',
        level: \'core\',
        topics: [
          \'Unit 1: Numbers 1 to 5 – Counting, Reading and Writing\',
          \'Unit 2: Numbers 1 to 9 – Counting, Reading and Writing\',
          \'Unit 3: Numbers 0 to 10 – Ordering and Comparing\',
          \'Unit 4: Numbers 0 to 20 – Addition and Subtraction\',
          \'Unit 5: Multiplication and Division by 2\',
          \'Unit 6: Numbers 0 to 50 – Place Value and Operations\',
          \'Unit 7: Numbers 0 to 100 – Counting and Operations\',
          \'Unit 8: Fractions – Halves and Quarters\',
          \'Unit 9: Number Patterns\',
          \'Unit 10: Measuring Lengths up to 10 m\',
          \'Unit 11: Parts of the Day and Days of the Week\',
          \'Unit 12: Rwandan Currency 1–100 Frw\',
          \'Unit 13: Directions and Location of Objects\',
          \'Unit 14: Right Angle, Square and Rectangle\',
        ],
      },
      {
        name: \'English\',
        level: \'core\',
        topics: [
          \'Unit 1: Welcome to the Classroom – Greetings and Instructions\',
          \'Unit 2: Classroom Objects – Naming and Describing\',
          \'Unit 3: People at Home – Family Members and Roles\',
          \'Unit 4: Clothes and Parts of My Body\',
          \'Unit 5: Likes and Dislikes\',
          \'Unit 6: Classroom Objects and Personal Belongings\',
          \'Unit 7: Home – Rooms and Household Items\',
          \'Unit 8: Animals at Home – Domestic Animals\',
          \'Unit 9: What We Do Every Day – Daily Routines\',
          \'Unit 10: Story Telling – Listening and Responding\',
        ],
      },
      {
        name: \'Kinyarwanda\',
        level: \'core\',
        topics: [
          \'Umutwe 1: Umuco n\\\'indangagaciro – Culture and Values\',
          \'Umutwe 2: Isuku – Cleanliness and Hygiene\',
          \'Umutwe 3: Umuryango – The Family\',
          \'Umutwe 4: Ibidukikije – Our Environment\',
          \'Umutwe 5: Uburenganzira bw\\\'umwana – Children\'s Rights\',
          \'Umutwe 6: Kwirinda no gukumira ihohoterwa – Preventing Violence\',
          \'Umutwe 7: Inyamaswa zo mu rugo – Domestic Animals\',
          \'Umutwe 8: Indyo yuzuye – Balanced Diet\',
          \'Umutwe 9: Kuzigama – Saving and Conservation\',
        ],
      },
      {
        name: \'French\',
        level: \'core\',
        topics: [
          \'Unité 1: Les salutations – Greetings\',
          \'Unité 2: Se présenter – Introducing Oneself\',
          \'Unité 3: La famille – Family Members\',
          \'Unité 4: Les objets de la classe – Classroom Objects\',
          \'Unité 5: Les couleurs et les chiffres – Colours and Numbers\',
          \'Unité 6: Les animaux – Animals\',
        ],
      },
      {
        name: \'Science and Elementary Technology\',
        level: \'core\',
        topics: [
          \'Unit 1: Materials Used at School and at Home\',
          \'Unit 2: ICT Tools – Introduction to Computers and Devices\',
          \'Unit 3: Water – Uses and Importance\',
          \'Unit 4: Animals – Types and Characteristics\',
          \'Unit 5: Plants – Parts and Uses\',
          \'Unit 6: The Main Parts of the Human Body\',
        ],
      },
      {
        name: \'Social Studies and Religious Education\',
        level: \'core\',
        topics: [
          \'Unit 1: Family Members – Roles and Responsibilities\',
          \'Unit 2: Local Government Organisation\',
          \'Unit 3: National Symbols of Rwanda\',
          \'Unit 4: School Leaders and School Symbols\',
          \'Unit 5: Personal Hygiene\',
          \'Unit 6: Living in Harmony and Good Behaviours\',
          \'Unit 7: Politeness and Respect\',
          \'Unit 8: Family Property – Care and Responsibility\',
          \'Unit 9: Our Environment – Care and Protection\',
          \'Unit 10: Transport and Communication\',
          \'Unit 11: Family Historical Events\',
          \'Unit 12: God\'s Creation\',
          \'Unit 13: Prayer – Talking to God\',
          \'Unit 14: Promoting Peace and Honesty\',
        ],
      },
    ],
  },

  2: {
    grade: 2,
    rwandaLevel: \'P2\',
    description: \'Primary Two – Lower Primary Education (ages 7–8)\',
    subjects: [
      {
        name: \'Mathematics\',
        level: \'core\',
        topics: [
          \'Unit 1: Numbers 0 to 200 – Place Value and Operations\',
          \'Unit 2: Numbers up to 500 – Addition and Subtraction\',
          \'Unit 3: Numbers up to 1000 – Comparing and Ordering\',
          \'Unit 4: Fractions – Halves, Quarters and Thirds\',
          \'Unit 5: Length Measurement – cm and m\',
          \'Unit 6: Litre – Standard Unit of Capacity\',
          \'Unit 7: Kilogram – Standard Unit of Mass\',
          \'Unit 8: Rwandan Francs up to 1000 Frw\',
          \'Unit 9: Hour, Months of the Year and Days of Each Month\',
          \'Unit 10: Types of Lines and Angles\',
          \'Unit 11: Grid – Reading and Drawing\',
          \'Unit 12: Square, Rectangle and Triangle – Properties\',
          \'Unit 13: Missing Numbers in Addition and Subtraction\',
          \'Unit 14: Pictographs – Reading and Drawing\',
        ],
      },
      {
        name: \'English\',
        level: \'core\',
        topics: [
          \'Unit 1: Greetings, Introductions and Talking about School\',
          \'Unit 2: Games and Sports\',
          \'Unit 3: Telling the Time\',
          \'Unit 4: Food – Naming and Describing Healthy Food\',
          \'Unit 5: Stories and Descriptions\',
          \'Unit 6: Family Members and Household Activities\',
          \'Unit 7: Weather – Describing Weather Conditions\',
          \'Unit 8: The Zoo – Wild Animals\',
          \'Unit 9: Counting and Writing Numbers in Words\',
          \'Unit 10: Past and Future Tense\',
        ],
      },
      {
        name: \'Kinyarwanda\',
        level: \'core\',
        topics: [
          \'Umutwe 1: Umuco w\\\'amahoro – Culture of Peace\',
          \'Umutwe 2: Inshingano z\\\'abana – Children\'s Responsibilities\',
          \'Umutwe 3: Uburenganzira bw\\\'abana – Children\'s Rights\',
          \'Umutwe 4: Imiyoborere myiza – Good Governance\',
          \'Umutwe 5: Isuku – Hygiene and Cleanliness\',
          \'Umutwe 6: Ikoranabuhanga n\\\'itumanaho – Technology and Communication\',
          \'Umutwe 7: Iterambere – Development\',
          \'Umutwe 8: Ubuzima – Health and Wellbeing\',
        ],
      },
      {
        name: \'French\',
        level: \'core\',
        topics: [
          \'Unité 1: Les salutations – Greetings\',
          \'Unité 2: Se présenter – Introducing Oneself\',
          \'Unité 3: La famille – My Family\',
          \'Unité 4: Les activités – Daily Activities\',
          \'Unité 5: Les animaux – Animals\',
          \'Unité 6: La nourriture – Food\',
        ],
      },
      {
        name: \'Science and Elementary Technology\',
        level: \'core\',
        topics: [
          \'Unit 1: Living Things at School and at Home\',
          \'Unit 2: Making Toys and Classroom Learning Materials\',
          \'Unit 3: Computer My Friend – Basic ICT Skills\',
          \'Unit 4: Plants – Growth, Care and Uses\',
          \'Unit 5: Waste and Hygiene – Keeping Our Environment Clean\',
          \'Unit 6: Light and Heat – Sources and Uses\',
        ],
      },
      {
        name: \'Social Studies and Religious Education\',
        level: \'core\',
        topics: [
          \'Unit 1: An Extended Family\',
          \'Unit 2: Local Government Organization\',
          \'Unit 3: Relationships and Good Behaviours\',
          \'Unit 4: Economy – Basic Concepts and Activities\',
          \'Unit 5: Our Environment – Plants, Animals and Land\',
          \'Unit 6: Transport and Communication\',
          \'Unit 7: Main Historical Events at Home and at School\',
          \'Unit 8: The Creation of Humans – Religious Perspectives\',
          \'Unit 9: Living in Harmony with Others\',
          \'Unit 10: God\'s Message about Peace\',
        ],
      },
    ],
  },

  3: {
    grade: 3,
    rwandaLevel: \'P3\',
    description: \'Primary Three – Middle Primary Education (ages 8–9)\',
    subjects: [
      {
        name: \'Mathematics\',
        level: \'core\',
        topics: [
          \'Unit 1: Numbers up to 2,000 – Place Value, Ordering and Operations\',
          \'Unit 2: Numbers 0 to 5,000 – Addition and Subtraction\',
          \'Unit 3: Numbers up to 10,000 – Multiplication and Division\',
          \'Unit 4: Fractions with Denominator up to 10\',
          \'Unit 5: Relationship Between Length Measurements (m, cm, mm)\',
          \'Unit 6: Mass Measurements – Kilogram to Gram\',
          \'Unit 7: Capacity Measurements – Litre to Millilitre\',
          \'Unit 8: Rwandan Francs 1–5,000 Frw\',
          \'Unit 9: Time Measurements – Hours, Minutes and Seconds\',
          \'Unit 10: Types of Lines and Angles\',
          \'Unit 11: Square, Rectangle, Triangle and Circle\',
          \'Unit 12: Grid – Reading Coordinates\',
          \'Unit 13: Missing Numbers in Addition, Subtraction and Multiplication\',
          \'Unit 14: Pictographs – Reading and Interpreting Data\',
        ],
      },
      {
        name: \'English\',
        level: \'core\',
        topics: [
          \'Unit 1: Places in the Community\',
          \'Unit 2: Jobs in our Community\',
          \'Unit 3: Time – Telling the Time and Time Expressions\',
          \'Unit 4: Events in the Past and Future – Tenses\',
          \'Unit 5: Domestic Animals\',
          \'Unit 6: The Body and Health – Body Parts and Keeping Healthy\',
          \'Unit 7: Clothes – Types, Seasons and Description\',
          \'Unit 8: Rwanda – Geography and Culture\',
          \'Unit 9: Counting with Graphs – Reading Bar Graphs\',
          \'Unit 10: Shopping – Money and Transactions\',
        ],
      },
      {
        name: \'Kinyarwanda\',
        level: \'core\',
        topics: [
          \'Umutwe 1: Imyuga gakondo – Traditional Crafts\',
          \'Umutwe 2: Kubungabunga ubuzima – Health Promotion\',
          \'Umutwe 3: Uburenganzira n\\\'inshingano by\\\'umwana – Children\'s Rights and Responsibilities\',
          \'Umutwe 4: Inyamaswa zo mu gasozi – Wild Animals\',
          \'Umutwe 5: Umuco w\\\'amahoro – Culture of Peace\',
          \'Umutwe 6: Siporo n\\\'imyidagaduro – Sports and Recreation\',
          \'Umutwe 7: Gukunda umurimo – Love of Work\',
          \'Umutwe 8: Gukunda igihugu – Patriotism and Love of Country\',
        ],
      },
      {
        name: \'French\',
        level: \'core\',
        topics: [
          \'Unité 1: Révision de 2e année – Review of Year 2\',
          \'Unité 2: La langue de la classe – Classroom Language\',
          \'Unité 3: Se situer dans l\'espace – Describing Location\',
          \'Unité 4: La famille et la maison – Family and Home\',
          \'Unité 5: Les métiers – Jobs and Professions\',
          \'Unité 6: La santé – Health and the Body\',
        ],
      },
      {
        name: \'Science and Elementary Technology\',
        level: \'core\',
        topics: [
          \'Unit 1: Agricultural Tools – Uses and Safety\',
          \'Unit 2: Writing with a Computer – Word Processing Basics\',
          \'Unit 3: Drinking Water – Sources, Treatment and Importance\',
          \'Unit 4: Animals – Classification and Adaptation\',
          \'Unit 5: Electricity – Sources and Safe Use\',
          \'Unit 6: Magnets – Properties and Uses\',
        ],
      },
      {
        name: \'Social Studies and Religious Education\',
        level: \'core\',
        topics: [
          \'Unit 1: An Extended Family – Roles and Relationships\',
          \'Unit 2: Our Sector – Administrative Structure\',
          \'Unit 3: Hygiene – Personal and Community Cleanliness\',
          \'Unit 4: Relationships and Good Behaviours\',
          \'Unit 5: Economy – Local Economic Activities\',
          \'Unit 6: Environment in Our Sector – Conservation\',
          \'Unit 7: Transport and Communication\',
          \'Unit 8: Main Historical Events of Our Sector\',
          \'Unit 9: Respect for God\'s Creatures\',
          \'Unit 10: Not Doing Wrong Things and Asking for Forgiveness\',
          \'Unit 11: Peace and Justice\',
        ],
      },
    ],
  },

  4: {
    grade: 4,
    rwandaLevel: \'P4\',
    description: \'Primary Four – Upper Primary Education (ages 9–10)\',
    subjects: [
      {
        name: \'Mathematics\',
        level: \'core\',
        topics: [
          \'Unit 1: Operations on Whole Numbers up to 100,000\',
          \'Unit 2: Positive and Negative Integers\',
          \'Unit 3: Classifying Numbers by Their Properties (even, odd, prime, composite)\',
          \'Unit 4: Fractions with the Same Denominator – Operations\',
          \'Unit 5: Decimal Numbers – Introduction and Operations\',
          \'Unit 6: Length Measurements – Conversion and Problems\',
          \'Unit 7: Capacity Measurements – Litres and Millilitres\',
          \'Unit 8: Mass Measurements – kg and g\',
          \'Unit 9: Area and Land Measurements\',
          \'Unit 10: Time – Hours, Minutes, Seconds, Calendar\',
          \'Unit 11: Number Patterns – Sequences and Rules\',
          \'Unit 12: Solving Problems with Missing Numbers\',
          \'Unit 13: Lines and Angles – Types and Properties\',
          \'Unit 14: Shapes in the Plane – Properties of Polygons\',
          \'Unit 15: Area of Shapes in the Plane\',
          \'Unit 16: Introduction to Data Handling – Tables and Graphs\',
          \'Unit 17: Introduction to Games of Chance – Probability\',
        ],
      },
      {
        name: \'English\',
        level: \'core\',
        topics: [
          \'Unit 1: Our School – Describing School Life\',
          \'Unit 2: My Friends and I – Friendships and Activities\',
          \'Unit 3: Our District – Places and Services\',
          \'Unit 4: Weather – Describing Seasons and Climate\',
          \'Unit 5: Jobs and Roles in Home and Community\',
          \'Unit 6: Wild Animals – Habitats and Characteristics\',
          \'Unit 7: Rights, Responsibilities, and Needs\',
          \'Unit 8: Talking about the Past – Past Tense\',
          \'Unit 9: Countries, Rivers and Famous Architectural Structures of the World\',
        ],
      },
      {
        name: \'Kinyarwanda\',
        level: \'core\',
        topics: [
          \'Umutwe 1: Iterambere – Development and Progress\',
          \'Umutwe 2: Kubana neza n\\\'abandi – Living Well with Others\',
          \'Umutwe 3: Umuco Nyarwanda – Rwandan Culture and Heritage\',
          \'Umutwe 4: Gukunda igihugu – Patriotism\',
          \'Umutwe 5: Imikino n\\\'imyidagaduro – Games and Recreation\',
          \'Umutwe 6: Gukunda no kwitabira umurimo – Love and Commitment to Work\',
        ],
      },
      {
        name: \'French\',
        level: \'core\',
        topics: [
          \'Unité 1: Révision de 3e année – Review\',
          \'Unité 2: De mon pays à mon quartier – From My Country to My Neighbourhood\',
          \'Unité 3: Les transports – Transport and Travel\',
          \'Unité 4: Les fêtes et les célébrations – Celebrations\',
          \'Unité 5: La nourriture et la santé – Food and Health\',
          \'Unité 6: L\'environnement – Our Environment\',
        ],
      },
      {
        name: \'Science and Elementary Technology\',
        level: \'core\',
        topics: [
          \'Unit 1: Objects Production – Making and Testing Materials\',
          \'Unit 2: ICT Basics – Hardware, Software and File Management\',
          \'Unit 3: Graphics and Multimedia – Introduction\',
          \'Unit 4: Programming for Children – Basic Coding Concepts\',
          \'Unit 5: Air, Wind and Sound – Properties and Uses\',
          \'Unit 6: Soil – Types, Composition and Importance\',
          \'Unit 7: Animals Classification – Vertebrates and Invertebrates\',
          \'Unit 8: Rabbits and Chickens Management\',
          \'Unit 9: Plants Germination – Conditions and Process\',
          \'Unit 10: Human Sensory Organs – Structure and Function\',
          \'Unit 11: Human Skeleton – Structure and Function\',
          \'Unit 12: Muscles – Types and Function\',
        ],
      },
      {
        name: \'Social Studies and Religious Education\',
        level: \'core\',
        topics: [
          \'Unit 1: Socio-economic Activities in Our District\',
          \'Unit 2: Peace Education and Human Rights\',
          \'Unit 3: Economy – Trade, Money and Markets\',
          \'Unit 4: Civics and Governance – Democratic Institutions\',
          \'Unit 5: Weather, Flora and Fauna in Rwanda\',
          \'Unit 6: Infrastructure – Roads, Schools, Hospitals\',
          \'Unit 7: Traditional Rwanda – Culture and History\',
          \'Unit 8: God\'s Commandments\',
          \'Unit 9: Introduction to Christian and Islamic Faith\',
          \'Unit 10: Values in the Bible and Qur\'an\',
        ],
      },
      {
        name: \'Creative Arts\',
        level: \'core\',
        topics: [
          \'Fine Arts Unit 1: Drawing and Painting Still Life Figures\',
          \'Fine Arts Unit 2: Motif Design – Patterns and Repetition\',
          \'Fine Arts Unit 3: Letter Styles – Calligraphy and Typography\',
          \'Fine Arts Unit 4: Modelling and Decoration – Clay and Mixed Media\',
          \'Music Unit 1: Introduction to Music – Rhythm and Beat\',
          \'Music Unit 2: Music Staff and Treble Clef\',
          \'Music Unit 3: Introduction to C Scale\',
          \'Music Unit 4: Practice Songs in C Scale\',
          \'Music Unit 5: Introduction to the Piano Keyboard\',
        ],
      },
    ],
  },

  5: {
    grade: 5,
    rwandaLevel: \'P5\',
    description: \'Primary Five – Upper Primary Education (ages 10–11)\',
    subjects: [
      {
        name: \'Mathematics\',
        level: \'core\',
        topics: [
          \'Unit 1: Whole Numbers up to 10,000,000 – Reading, Writing, Comparing and Calculating\',
          \'Unit 2: Addition and Subtraction of Integers\',
          \'Unit 3: Prime Factorization and Divisibility Tests\',
          \'Unit 4: Equivalent Fractions and Operations (add, subtract, multiply, divide)\',
          \'Unit 5: Multiplication and Division of Decimal Numbers\',
          \'Unit 6: Application of Direct Proportion\',
          \'Unit 7: Problems Involving Measurements of Length, Capacity and Mass\',
          \'Unit 8: Solving Problems Involving Time Intervals\',
          \'Unit 9: Money and Financial Applications\',
          \'Unit 10: Sequences – Whole Numbers, Fractions and Decimals\',
          \'Unit 11: Constructing and Describing Angles Formed by Intersecting Lines\',
          \'Unit 12: Interpreting and Constructing Scale Drawings\',
          \'Unit 13: Circumference of a Circle, Surface Area and Volume\',
          \'Unit 14: Data Handling – Frequency Tables, Bar Charts and Pie Charts\',
          \'Unit 15: Introduction to Likelihood of Events\',
        ],
      },
      {
        name: \'English\',
        level: \'core\',
        topics: [
          \'Unit 1: Past and Future Events – Narrative and Prediction\',
          \'Unit 2: Classroom Language – Instructions and Discussion\',
          \'Unit 3: Reading – Comprehension Strategies\',
          \'Unit 4: Environment – Conservation and Sustainability\',
          \'Unit 5: Measurements – Describing Quantities and Units\',
          \'Unit 6: Transport – Types, Safety and Technology\',
          \'Unit 7: Hygiene and Health – Disease Prevention\',
          \'Unit 8: Crafts in Rwanda – Traditional and Modern\',
          \'Unit 9: Traditional and Modern Agriculture in Rwanda\',
          \'Unit 10: Geography of the World – Continents and Countries\',
        ],
      },
      {
        name: \'Kinyarwanda\',
        level: \'core\',
        topics: [
          \'Umutwe 1: Umuco Nyarwanda – Rwandan Culture and Traditions\',
          \'Umutwe 2: Ibidukikije – Environment and Conservation\',
          \'Umutwe 3: Uburenganzira bwa muntu – Human Rights\',
          \'Umutwe 4: Ubuzima – Health and Wellbeing\',
          \'Umutwe 5: Imiyoborere myiza – Good Governance\',
          \'Umutwe 6: Umuco w\\\'amahoro – Culture of Peace\',
        ],
      },
      {
        name: \'French\',
        level: \'core\',
        topics: [
          \'Unité 1: Révision de 4e année – Review\',
          \'Unité 2: Se situer dans le temps – Talking about Time\',
          \'Unité 3: L\'environnement naturel – Natural Environment\',
          \'Unité 4: La santé et l\'hygiène – Health and Hygiene\',
          \'Unité 5: Les voyages et le transport – Travel and Transport\',
          \'Unité 6: Les métiers et le travail – Professions and Work\',
        ],
      },
      {
        name: \'Science and Elementary Technology\',
        level: \'core\',
        topics: [
          \'Unit 1: Carpentry Tools – Uses, Safety and Maintenance\',
          \'Unit 2: Masonry Tools – Uses and Safety\',
          \'Unit 3: Light – Properties, Reflection and Refraction\',
          \'Unit 4: Computer Memories and Storage Devices\',
          \'Unit 5: Word Processing Writing Skills\',
          \'Unit 6: Computer Research – Internet and Information Literacy\',
          \'Unit 7: Programming for Children – Coding Fundamentals\',
          \'Unit 8: Water Pollution – Causes, Effects and Prevention\',
          \'Unit 9: Soil and Cultivation – Farming Practices\',
          \'Unit 10: Plants and Environment – Photosynthesis and Ecosystems\',
          \'Unit 11: Human Digestive System – Organs and Function\',
          \'Unit 12: Human Diseases – Common Diseases and Prevention\',
          \'Unit 13: Electricity – Circuits and Energy\',
          \'Unit 14: Materials and States of Matter\',
        ],
      },
      {
        name: \'Social Studies and Religious Education\',
        level: \'core\',
        topics: [
          \'Unit 1: Map of Our Province and Its Location\',
          \'Unit 2: Complementarity and Social Cohesion in the Society\',
          \'Unit 3: Hygiene and Sanitation – Community Health\',
          \'Unit 4: Economy – Production, Trade and Finance\',
          \'Unit 5: Environment and Climate in Our Province\',
          \'Unit 6: Social Services and Important Places in Our Province\',
          \'Unit 7: Population – Growth, Distribution and Migration\',
          \'Unit 8: Colonial Rwanda – Impact and Resistance\',
          \'Unit 9: Notion of the Bible and Qur\'an\',
          \'Unit 10: Acts of Charity in the Community and Faith\',
          \'Unit 11: Sin and Its Consequences\',
        ],
      },
      {
        name: \'Creative Arts\',
        level: \'core\',
        topics: [
          \'Fine Arts Unit 1: Using Colour in Art – Colour Mixing and Painting\',
          \'Fine Arts Unit 2: Pattern Designs – Geometric and Organic Patterns\',
          \'Fine Arts Unit 3: Lettering Typeface – Fonts and Design\',
          \'Fine Arts Unit 4: Collage Art – Mixed Media Techniques\',
          \'Music Unit 1: Musical Notes Symbols and Values\',
          \'Music Unit 2: Tempos and Dynamics – Speed and Volume in Music\',
          \'Music Unit 3: Sol-Fa in C Scale – Singing and Reading Music\',
          \'Music Unit 4: Fingering on the Keyboard\',
        ],
      },
    ],
  },

  6: {
    grade: 6,
    rwandaLevel: \'P6\',
    description: \'Primary Six – Upper Primary Education / National Exam Year (ages 11–12)\',
    subjects: [
      {
        name: \'Mathematics\',
        level: \'core\',
        topics: [
          \'Unit 1: Whole Numbers – Reading, Writing, Comparing and Calculating\',
          \'Unit 2: Multiplication and Division of Integers\',
          \'Unit 3: Powers, Indices, LCM and GCF\',
          \'Unit 4: Operations on Fractions – All Four Operations\',
          \'Unit 5: Rounding and Conversion of Decimal Numbers\',
          \'Unit 6: Ratios, Proportions and Percentages\',
          \'Unit 7: Relationship Between Volume, Capacity and Mass\',
          \'Unit 8: Speed, Distance and Time\',
          \'Unit 9: Simple Interest and Problems Involving Saving\',
          \'Unit 10: Equivalent Expressions and Number Sequences\',
          \'Unit 11: Regular Polygons and Bearings\',
          \'Unit 12: Construction of Polygons and Nets for Cuboids and Prisms\',
          \'Unit 13: Area Bounded by a Circle, Surface Area and Volume of Solids\',
          \'Unit 14: Data Handling – Mean, Median, Mode, Charts and Graphs\',
          \'Unit 15: Likelihood of Events – Probability\',
        ],
      },
      {
        name: \'English\',
        level: \'core\',
        topics: [
          \'Unit 1: Leisure and Sports – Hobbies and Active Lifestyles\',
          \'Unit 2: Making Future Plans – Future Tense and Goal Setting\',
          \'Unit 3: Weather – Climate Patterns and Description\',
          \'Unit 4: Behaviour, Rules and Laws – Rights and Responsibilities\',
          \'Unit 5: Family Relationships – Roles and Communication\',
          \'Unit 6: Reading Books, Writing Compositions and Examinations\',
          \'Unit 7: Animals – Habitats, Adaptations and Classification\',
          \'Unit 8: Environment – Conservation and Climate Change\',
          \'Unit 9: Maintaining Harmony in the Family\',
        ],
      },
      {
        name: \'Kinyarwanda\',
        level: \'core\',
        topics: [
          \'Umutwe 1: Umuco Nyarwanda – Rwandan Culture and Identity\',
          \'Umutwe 2: Ibidukikije – Environment and Sustainability\',
          \'Umutwe 3: Ubuzima – Health, Nutrition and Wellbeing\',
          \'Umutwe 4: Uburinganire n\\\'ubwuzuzanye – Gender Equality and Complementarity\',
          \'Umutwe 5: Itumanaho n\\\'ikoranabuhanga – Communication and Technology\',
          \'Umutwe 6: Gukunda umurimo – Love of Work and Entrepreneurship\',
        ],
      },
      {
        name: \'French\',
        level: \'core\',
        topics: [
          \'Unité 1: Retour sur les contenus de 5e année – Review\',
          \'Unité 2: Les droits de l\\\'enfant – Children\'s Rights\',
          \'Unité 3: L\'environnement et le développement durable – Environment and Sustainability\',
          \'Unité 4: La santé et la médecine – Health and Medicine\',
          \'Unité 5: La technologie et le futur – Technology and the Future\',
          \'Unité 6: La citoyenneté – Citizenship and Community\',
        ],
      },
      {
        name: \'Science and Elementary Technology\',
        level: \'core\',
        topics: [
          \'Unit 1: Mechanics Tools – Types, Uses and Maintenance\',
          \'Unit 2: Simple Machines – Levers, Pulleys and Inclined Planes\',
          \'Unit 3: Air Pollution – Causes, Effects and Prevention\',
          \'Unit 4: Cows and Goats Management – Animal Husbandry\',
          \'Unit 5: Word Processing and Spreadsheet – Advanced ICT Skills\',
          \'Unit 6: Introduction to Emerging Technologies – AI, Robotics\',
          \'Unit 7: Programming for Children – Algorithms and Coding\',
          \'Unit 8: Plants Reproduction – Sexual and Asexual Reproduction\',
          \'Unit 9: Sustainable Waste Management – Reduce, Reuse, Recycle\',
          \'Unit 10: Human Circulatory System – Heart, Blood and Vessels\',
          \'Unit 11: Human Respiratory System – Lungs and Breathing\',
          \'Unit 12: Human Reproductive System – Puberty and Health\',
          \'Unit 13: Energy Management – Renewable and Non-renewable Energy\',
          \'Unit 14: Magnetism – Properties, Poles and Applications\',
        ],
      },
      {
        name: \'Social Studies and Religious Education\',
        level: \'core\',
        topics: [
          \'Unit 1: Our Country Rwanda – Geography, Provinces and Districts\',
          \'Unit 2: Civics and Governance – Democratic Institutions\',
          \'Unit 3: Rwandan Values and Risky Behaviours in Society\',
          \'Unit 4: Budget – Personal and National Financial Planning\',
          \'Unit 5: Direction and Location – Maps and Compass Bearings\',
          \'Unit 6: Physical Features and Effects of Climate Change\',
          \'Unit 7: Economic Activities – Agriculture, Industry and Services\',
          \'Unit 8: Natural Resources of Rwanda\',
          \'Unit 9: Transport and Communication in Rwanda\',
          \'Unit 10: The Peoples of East Africa\',
          \'Unit 11: Post-Independence Rwanda – 1962 to Present\',
          \'Unit 12: The 1994 Genocide Against the Tutsi – History and Commemoration\',
          \'Unit 13: God\'s Revelation – Faith and Belief\',
          \'Unit 14: Attributes of God – Love, Justice and Mercy\',
          \'Unit 15: Relationship and Friendship – Values and Respect\',
          \'Unit 16: Conflict Resolution – Dialogue and Reconciliation\',
        ],
      },
      {
        name: \'Creative Arts\',
        level: \'core\',
        topics: [
          \'Fine Arts Unit 1: Introduction to Composition Arrangement\',
          \'Fine Arts Unit 2: Digital Pattern Design\',
          \'Fine Arts Unit 3: Digital Signpost Design\',
          \'Fine Arts Unit 4: Introduction to Sewing – Basic Stitches\',
          \'Music Unit 1: Simple Time Signatures – 2/4, 3/4, 4/4\',
          \'Music Unit 2: Bass Staff and Grand Staff\',
          \'Music Unit 3: Piano Practice – Scales and Simple Pieces\',
        ],
      },
    ],
  },
'''

# Now build the full file content
new_content = header + p1_6_block + secondary_block

with open(ORIGINAL, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done! Curriculum file updated.")
print(f"New file size: {len(new_content):,} chars")
print(f"P1-P6 block size: {len(p1_6_block):,} chars")
print(f"Secondary block size: {len(secondary_block):,} chars")
