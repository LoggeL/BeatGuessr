#!/usr/bin/env python3
"""
BeatGuessr Song Scraper v3
Uses Spotify API for search + spotifyscraper for preview URLs (via embed page).
"""

import json
import re
import time
import sys
import base64
from pathlib import Path
from datetime import datetime

import requests
from bs4 import BeautifulSoup

# Try to import spotify_scraper for embed scraping
try:
    from spotify_scraper import SpotifyClient

    HAS_SCRAPER = True
except ImportError:
    HAS_SCRAPER = False
    print("Warning: spotify_scraper not available, will try direct embed scraping")

import os

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

# === Spotify API Configuration ===
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")


# === Configuration ===
START_YEAR = 1960
END_YEAR = 2025
MIN_SONGS_PER_YEAR = 10
REQUEST_DELAY = 0.5

# Patterns to exclude
EXCLUDE_PATTERNS = [
    r"\bremix\b",
    r"\bremaster",
    r"\blive\b",
    r"\bacoustic\b",
    r"\bcover\b",
    r"\bversion\b",
    r"\bedit\b",
    r"\bextended\b",
    r"\bradio\s*(mix|edit)\b",
    r"\bkaraoke\b",
    r"\binstrumental\b",
]

SCRIPT_DIR = Path(__file__).parent
CONTEXTS_FILE = SCRIPT_DIR / "contexts.json"
OUTPUT_FILE = SCRIPT_DIR.parent / "data" / "songs.json"


class SpotifyAPI:
    """Spotify API client."""

    def __init__(self, client_id, client_secret):
        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token = None
        self.token_expires = 0

    def _get_token(self):
        if self.access_token and time.time() < self.token_expires:
            return self.access_token

        auth_string = f"{self.client_id}:{self.client_secret}"
        auth_base64 = base64.b64encode(auth_string.encode()).decode()

        response = requests.post(
            "https://accounts.spotify.com/api/token",
            headers={
                "Authorization": f"Basic {auth_base64}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
        )

        if response.status_code != 200:
            raise Exception(f"Failed to get token: {response.text}")

        data = response.json()
        self.access_token = data["access_token"]
        self.token_expires = time.time() + data["expires_in"] - 60
        return self.access_token

    def search_track(self, title, artist):
        """Search for a track."""
        token = self._get_token()

        # Try specific search first
        query = f"track:{title} artist:{artist}"
        response = requests.get(
            "https://api.spotify.com/v1/search",
            headers={"Authorization": f"Bearer {token}"},
            params={"q": query, "type": "track", "limit": 5, "market": "DE"},
        )

        if response.status_code == 200:
            tracks = response.json().get("tracks", {}).get("items", [])
            if tracks:
                return tracks

        # Fallback to simple search
        query = f"{title} {artist}"
        response = requests.get(
            "https://api.spotify.com/v1/search",
            headers={"Authorization": f"Bearer {token}"},
            params={"q": query, "type": "track", "limit": 5, "market": "DE"},
        )

        if response.status_code == 200:
            return response.json().get("tracks", {}).get("items", [])
        return []


def get_preview_url_from_embed(track_id):
    """
    Get preview URL by scraping the Spotify embed page.
    The embed player still has preview URLs even though the API doesn't.
    """
    embed_url = f"https://open.spotify.com/embed/track/{track_id}"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }

    try:
        response = requests.get(embed_url, headers=headers, timeout=10)
        if response.status_code != 200:
            return None

        # Look for preview URL in the page
        # The preview URL format is: https://p.scdn.co/mp3-preview/...
        preview_match = re.search(
            r"https://p\.scdn\.co/mp3-preview/[a-zA-Z0-9]+", response.text
        )
        if preview_match:
            return preview_match.group(0)

        # Try to find in JSON data
        json_match = re.search(
            r'"audioPreview":\s*\{\s*"url":\s*"([^"]+)"', response.text
        )
        if json_match:
            return json_match.group(1)

    except Exception as e:
        pass

    return None


def get_preview_via_scraper(track_url):
    """Use spotifyscraper library to get preview URL."""
    if not HAS_SCRAPER:
        return None

    try:
        client = SpotifyClient()
        track_info = client.get_track_info(track_url)
        client.close()

        if track_info:
            return track_info.get("preview_url")
    except Exception as e:
        pass

    return None


def load_contexts():
    if CONTEXTS_FILE.exists():
        with open(CONTEXTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def is_excluded_title(title):
    title_lower = title.lower()
    for pattern in EXCLUDE_PATTERNS:
        if re.search(pattern, title_lower):
            return True
    return False


# Comprehensive fallback database with more songs per year
FALLBACK_DB = {
    1960: [
        ("Marina", "Rocco Granata"),
        ("Only the Lonely", "Roy Orbison"),
        ("Save the Last Dance for Me", "The Drifters"),
        ("The Twist", "Chubby Checker"),
        ("Cathy's Clown", "The Everly Brothers"),
        ("Running Bear", "Johnny Preston"),
        ("Teen Angel", "Mark Dinning"),
        ("El Paso", "Marty Robbins"),
        ("Handy Man", "Jimmy Jones"),
        ("Stuck on You", "Elvis Presley"),
        ("Walk Don't Run", "The Ventures"),
        ("Alley Oop", "Hollywood Argyles"),
    ],
    1961: [
        ("Wooden Heart", "Elvis Presley"),
        ("Stand by Me", "Ben E. King"),
        ("Blue Moon", "The Marcels"),
        ("Runaway", "Del Shannon"),
        ("Travelin Man", "Ricky Nelson"),
        ("Will You Love Me Tomorrow", "The Shirelles"),
        ("Take Good Care of My Baby", "Bobby Vee"),
        ("Hit the Road Jack", "Ray Charles"),
        ("Please Mr Postman", "The Marvelettes"),
        ("The Lion Sleeps Tonight", "The Tokens"),
        ("Tossin And Turnin", "Bobby Lewis"),
        ("Michael", "The Highwaymen"),
    ],
    1962: [
        ("I Cant Stop Loving You", "Ray Charles"),
        ("The Twist", "Chubby Checker"),
        ("Roses Are Red", "Bobby Vinton"),
        ("Breaking Up Is Hard to Do", "Neil Sedaka"),
        ("The Loco-Motion", "Little Eva"),
        ("Sherry", "The Four Seasons"),
        ("Soldier Boy", "The Shirelles"),
        ("Duke of Earl", "Gene Chandler"),
        ("Johnny Angel", "Shelley Fabares"),
        ("Big Girls Dont Cry", "The Four Seasons"),
        ("He's A Rebel", "The Crystals"),
        ("Monster Mash", "Bobby Boris Pickett"),
    ],
    1963: [
        ("She Loves You", "The Beatles"),
        ("I Want to Hold Your Hand", "The Beatles"),
        ("Be My Baby", "The Ronettes"),
        ("Louie Louie", "The Kingsmen"),
        ("Sugar Shack", "Jimmy Gilmer"),
        ("So Much in Love", "The Tymes"),
        ("Surfin USA", "The Beach Boys"),
        ("He's So Fine", "The Chiffons"),
        ("Walk Like a Man", "The Four Seasons"),
        ("My Boyfriend's Back", "The Angels"),
        ("It's My Party", "Lesley Gore"),
        ("Blue Velvet", "Bobby Vinton"),
    ],
    1964: [
        ("A Hard Days Night", "The Beatles"),
        ("Oh Pretty Woman", "Roy Orbison"),
        ("Baby Love", "The Supremes"),
        ("I Get Around", "The Beach Boys"),
        ("House of the Rising Sun", "The Animals"),
        ("Where Did Our Love Go", "The Supremes"),
        ("Chapel of Love", "The Dixie Cups"),
        ("Do Wah Diddy Diddy", "Manfred Mann"),
        ("Come See About Me", "The Supremes"),
        ("Dancing in the Street", "Martha and the Vandellas"),
        ("My Guy", "Mary Wells"),
        ("Under the Boardwalk", "The Drifters"),
    ],
    1965: [
        ("Help", "The Beatles"),
        ("Satisfaction", "The Rolling Stones"),
        ("Yesterday", "The Beatles"),
        ("I Cant Help Myself", "Four Tops"),
        ("Stop In the Name of Love", "The Supremes"),
        ("Turn Turn Turn", "The Byrds"),
        ("Mr Tambourine Man", "The Byrds"),
        ("Get Off of My Cloud", "The Rolling Stones"),
        ("Wooly Bully", "Sam the Sham"),
        ("Downtown", "Petula Clark"),
        ("Ticket to Ride", "The Beatles"),
        ("Hang on Sloopy", "The McCoys"),
    ],
    1966: [
        ("Yellow Submarine", "The Beatles"),
        ("Good Vibrations", "The Beach Boys"),
        ("Paint It Black", "The Rolling Stones"),
        ("Wild Thing", "The Troggs"),
        ("Last Train to Clarksville", "The Monkees"),
        ("Im a Believer", "The Monkees"),
        ("You Cant Hurry Love", "The Supremes"),
        ("Reach Out Ill Be There", "Four Tops"),
        ("96 Tears", "Question Mark and the Mysterians"),
        ("Cherish", "The Association"),
        ("Summer in the City", "The Lovin Spoonful"),
        ("Monday Monday", "The Mamas and the Papas"),
    ],
    1967: [
        ("All You Need Is Love", "The Beatles"),
        ("Light My Fire", "The Doors"),
        ("San Francisco", "Scott McKenzie"),
        ("Respect", "Aretha Franklin"),
        ("The Letter", "The Box Tops"),
        ("Happy Together", "The Turtles"),
        ("To Sir with Love", "Lulu"),
        ("A Whiter Shade of Pale", "Procol Harum"),
        ("Windy", "The Association"),
        ("Groovin", "The Young Rascals"),
        ("Somebody to Love", "Jefferson Airplane"),
        ("I Think We're Alone Now", "Tommy James"),
    ],
    1968: [
        ("Hey Jude", "The Beatles"),
        ("Mrs Robinson", "Simon and Garfunkel"),
        ("Born to Be Wild", "Steppenwolf"),
        ("Jumpin Jack Flash", "The Rolling Stones"),
        ("People Got to Be Free", "The Rascals"),
        ("Sunshine of Your Love", "Cream"),
        ("Tighten Up", "Archie Bell and the Drells"),
        ("This Guy's in Love with You", "Herb Alpert"),
        ("Harper Valley PTA", "Jeannie C Riley"),
        ("Love Is All Around", "The Troggs"),
        ("Hello I Love You", "The Doors"),
        ("Those Were the Days", "Mary Hopkin"),
    ],
    1969: [
        ("Sugar Sugar", "The Archies"),
        ("Get Back", "The Beatles"),
        ("Come Together", "The Beatles"),
        ("Suspicious Minds", "Elvis Presley"),
        ("I Cant Get Next to You", "The Temptations"),
        ("Honky Tonk Women", "The Rolling Stones"),
        ("Everyday People", "Sly and the Family Stone"),
        ("Crimson and Clover", "Tommy James"),
        ("Aquarius Let the Sunshine In", "The 5th Dimension"),
        ("In the Year 2525", "Zager and Evans"),
        ("Hot Fun in the Summertime", "Sly and the Family Stone"),
        ("Bad Moon Rising", "Creedence Clearwater Revival"),
    ],
    1970: [
        ("Let It Be", "The Beatles"),
        ("Bridge over Troubled Water", "Simon and Garfunkel"),
        ("Layla", "Derek and the Dominos"),
        ("War", "Edwin Starr"),
        ("Raindrops Keep Fallin on My Head", "BJ Thomas"),
        ("American Woman", "The Guess Who"),
        ("Mama Told Me Not to Come", "Three Dog Night"),
        ("Aint No Mountain High Enough", "Diana Ross"),
        ("Cracklin Rosie", "Neil Diamond"),
        ("The Tears of a Clown", "Smokey Robinson"),
        ("Venus", "Shocking Blue"),
        ("I Want You Back", "The Jackson 5"),
    ],
    1971: [
        ("Imagine", "John Lennon"),
        ("Stairway to Heaven", "Led Zeppelin"),
        ("Brown Sugar", "The Rolling Stones"),
        ("Maggie May", "Rod Stewart"),
        ("Its Too Late", "Carole King"),
        ("Joy to the World", "Three Dog Night"),
        ("How Can You Mend a Broken Heart", "Bee Gees"),
        ("Go Away Little Girl", "Donny Osmond"),
        ("Theme from Shaft", "Isaac Hayes"),
        ("Family Affair", "Sly and the Family Stone"),
        ("Indian Reservation", "Paul Revere and the Raiders"),
        ("Just My Imagination", "The Temptations"),
    ],
    1972: [
        ("American Pie", "Don McLean"),
        ("Without You", "Harry Nilsson"),
        ("Schools Out", "Alice Cooper"),
        ("Lean on Me", "Bill Withers"),
        ("The First Time Ever I Saw Your Face", "Roberta Flack"),
        ("I Can See Clearly Now", "Johnny Nash"),
        ("Alone Again Naturally", "Gilbert O Sullivan"),
        ("Baby Dont Get Hooked on Me", "Mac Davis"),
        ("Heart of Gold", "Neil Young"),
        ("A Horse with No Name", "America"),
        ("Superstition", "Stevie Wonder"),
        ("Brandy", "Looking Glass"),
    ],
    1973: [
        ("Angie", "The Rolling Stones"),
        ("Smoke on the Water", "Deep Purple"),
        ("Killing Me Softly", "Roberta Flack"),
        ("Tie a Yellow Ribbon", "Tony Orlando and Dawn"),
        ("Crocodile Rock", "Elton John"),
        ("You're So Vain", "Carly Simon"),
        ("Bad Bad Leroy Brown", "Jim Croce"),
        ("Let's Get It On", "Marvin Gaye"),
        ("Keep on Truckin", "Eddie Kendricks"),
        ("My Love", "Paul McCartney"),
        ("Free Bird", "Lynyrd Skynyrd"),
        ("Midnight Train to Georgia", "Gladys Knight"),
    ],
    1974: [
        ("Waterloo", "ABBA"),
        ("Kung Fu Fighting", "Carl Douglas"),
        ("Killer Queen", "Queen"),
        ("The Way We Were", "Barbra Streisand"),
        ("Seasons in the Sun", "Terry Jacks"),
        ("Cat's in the Cradle", "Harry Chapin"),
        ("I Shot the Sheriff", "Eric Clapton"),
        ("Rock the Boat", "Hues Corporation"),
        ("Annie's Song", "John Denver"),
        ("Bennie and the Jets", "Elton John"),
        ("Dancing Machine", "The Jackson 5"),
        ("Rock Your Baby", "George McCrae"),
    ],
    1975: [
        ("Bohemian Rhapsody", "Queen"),
        ("Mamma Mia", "ABBA"),
        ("SOS", "ABBA"),
        ("Love Will Keep Us Together", "Captain and Tennille"),
        ("Rhinestone Cowboy", "Glen Campbell"),
        ("Fame", "David Bowie"),
        ("Fly Robin Fly", "Silver Convention"),
        ("Philadelphia Freedom", "Elton John"),
        ("One of These Nights", "Eagles"),
        ("Best of My Love", "Eagles"),
        ("Laughter in the Rain", "Neil Sedaka"),
        ("Jive Talkin", "Bee Gees"),
    ],
    1976: [
        ("Dancing Queen", "ABBA"),
        ("Fernando", "ABBA"),
        ("Money Money Money", "ABBA"),
        ("Don't Go Breaking My Heart", "Elton John and Kiki Dee"),
        ("December 1963", "The Four Seasons"),
        ("Play That Funky Music", "Wild Cherry"),
        ("Silly Love Songs", "Wings"),
        ("50 Ways to Leave Your Lover", "Paul Simon"),
        ("Disco Lady", "Johnnie Taylor"),
        ("Kiss and Say Goodbye", "The Manhattans"),
        ("A Fifth of Beethoven", "Walter Murphy"),
        ("I Write the Songs", "Barry Manilow"),
    ],
    1977: [
        ("Hotel California", "Eagles"),
        ("Stayin Alive", "Bee Gees"),
        ("We Are the Champions", "Queen"),
        ("How Deep Is Your Love", "Bee Gees"),
        ("Dreams", "Fleetwood Mac"),
        ("You Make Me Feel Like Dancing", "Leo Sayer"),
        ("Rich Girl", "Hall and Oates"),
        ("I Just Want to Be Your Everything", "Andy Gibb"),
        ("Best of My Love", "The Emotions"),
        ("Undercover Angel", "Alan O Day"),
        ("You Light Up My Life", "Debby Boone"),
        ("Dancing Queen", "ABBA"),
    ],
    1978: [
        ("Night Fever", "Bee Gees"),
        ("Rivers of Babylon", "Boney M"),
        ("YMCA", "Village People"),
        ("Youre the One That I Want", "John Travolta and Olivia Newton-John"),
        ("Shadow Dancing", "Andy Gibb"),
        ("Kiss You All Over", "Exile"),
        ("Stayin Alive", "Bee Gees"),
        ("Three Times a Lady", "Commodores"),
        ("Boogie Oogie Oogie", "A Taste of Honey"),
        ("With a Little Luck", "Wings"),
        ("Le Freak", "Chic"),
        ("MacArthur Park", "Donna Summer"),
    ],
    1979: [
        ("I Will Survive", "Gloria Gaynor"),
        ("Another Brick in the Wall", "Pink Floyd"),
        ("Dont Stop Me Now", "Queen"),
        ("My Sharona", "The Knack"),
        ("Bad Girls", "Donna Summer"),
        ("Le Freak", "Chic"),
        ("Tragedy", "Bee Gees"),
        ("Hot Stuff", "Donna Summer"),
        ("Do Ya Think Im Sexy", "Rod Stewart"),
        ("Ring My Bell", "Anita Ward"),
        ("Good Times", "Chic"),
        ("Heart of Glass", "Blondie"),
    ],
    1980: [
        ("Super Trouper", "ABBA"),
        ("Another One Bites the Dust", "Queen"),
        ("Call Me", "Blondie"),
        ("Funkytown", "Lipps Inc"),
        ("Lady", "Kenny Rogers"),
        ("Upside Down", "Diana Ross"),
        ("Crazy Little Thing Called Love", "Queen"),
        ("Magic", "Olivia Newton-John"),
        ("Do That to Me One More Time", "Captain and Tennille"),
        ("Rock with You", "Michael Jackson"),
        ("Coming Up", "Paul McCartney"),
        ("Biggest Part of Me", "Ambrosia"),
    ],
    1981: [
        ("Dont You Want Me", "The Human League"),
        ("Tainted Love", "Soft Cell"),
        ("Under Pressure", "Queen and David Bowie"),
        ("Bette Davis Eyes", "Kim Carnes"),
        ("Endless Love", "Diana Ross and Lionel Richie"),
        ("Physical", "Olivia Newton-John"),
        ("9 to 5", "Dolly Parton"),
        ("Celebration", "Kool and The Gang"),
        ("Kiss on My List", "Hall and Oates"),
        ("Jessies Girl", "Rick Springfield"),
        ("I Love a Rainy Night", "Eddie Rabbitt"),
        ("Start Me Up", "The Rolling Stones"),
    ],
    1982: [
        ("Eye of the Tiger", "Survivor"),
        ("Come On Eileen", "Dexys Midnight Runners"),
        ("Africa", "Toto"),
        ("Centerfold", "J Geils Band"),
        ("I Love Rock n Roll", "Joan Jett"),
        ("Dont You Want Me", "The Human League"),
        ("Ebony and Ivory", "Paul McCartney and Stevie Wonder"),
        ("Jack and Diane", "John Mellencamp"),
        ("Hard to Say Im Sorry", "Chicago"),
        ("Abracadabra", "Steve Miller Band"),
        ("Maneater", "Hall and Oates"),
        ("Down Under", "Men at Work"),
    ],
    1983: [
        ("99 Luftballons", "Nena"),
        ("Billie Jean", "Michael Jackson"),
        ("Every Breath You Take", "The Police"),
        ("Beat It", "Michael Jackson"),
        ("Total Eclipse of the Heart", "Bonnie Tyler"),
        ("Flashdance What a Feeling", "Irene Cara"),
        ("Sweet Dreams", "Eurythmics"),
        ("All Night Long", "Lionel Richie"),
        ("Karma Chameleon", "Culture Club"),
        ("Islands in the Stream", "Kenny Rogers and Dolly Parton"),
        ("Say Say Say", "Paul McCartney and Michael Jackson"),
        ("Maniac", "Michael Sembello"),
    ],
    1984: [
        ("Like a Virgin", "Madonna"),
        ("Wake Me Up Before You Go-Go", "Wham"),
        ("Footloose", "Kenny Loggins"),
        ("When Doves Cry", "Prince"),
        ("Lets Go Crazy", "Prince"),
        ("What's Love Got to Do with It", "Tina Turner"),
        ("I Just Called to Say I Love You", "Stevie Wonder"),
        ("Jump", "Van Halen"),
        ("Hello", "Lionel Richie"),
        ("Karma Chameleon", "Culture Club"),
        ("Against All Odds", "Phil Collins"),
        ("Owner of a Lonely Heart", "Yes"),
    ],
    1985: [
        ("Take On Me", "a-ha"),
        ("We Are the World", "USA for Africa"),
        ("Running Up That Hill", "Kate Bush"),
        ("Careless Whisper", "George Michael"),
        ("Everybodys Wants to Rule the World", "Tears for Fears"),
        ("Shout", "Tears for Fears"),
        ("I Want to Know What Love Is", "Foreigner"),
        ("One More Night", "Phil Collins"),
        ("Saving All My Love for You", "Whitney Houston"),
        ("Money for Nothing", "Dire Straits"),
        ("A View to a Kill", "Duran Duran"),
        ("Part-Time Lover", "Stevie Wonder"),
    ],
    1986: [
        ("The Final Countdown", "Europe"),
        ("Take My Breath Away", "Berlin"),
        ("Living on a Prayer", "Bon Jovi"),
        ("Papa Dont Preach", "Madonna"),
        ("True Blue", "Madonna"),
        ("Walk Like an Egyptian", "The Bangles"),
        ("Rock Me Amadeus", "Falco"),
        ("Sledgehammer", "Peter Gabriel"),
        ("The Way It Is", "Bruce Hornsby"),
        ("Thats What Friends Are For", "Dionne and Friends"),
        ("Glory of Love", "Peter Cetera"),
        ("Kiss", "Prince"),
    ],
    1987: [
        ("Never Gonna Give You Up", "Rick Astley"),
        ("I Wanna Dance with Somebody", "Whitney Houston"),
        ("With or Without You", "U2"),
        ("La Bamba", "Los Lobos"),
        ("Livin on a Prayer", "Bon Jovi"),
        ("I Still Havent Found What Im Looking For", "U2"),
        ("Faith", "George Michael"),
        ("Alone", "Heart"),
        ("Bad", "Michael Jackson"),
        ("Open Your Heart", "Madonna"),
        ("Nothings Gonna Stop Us Now", "Starship"),
        ("Here I Go Again", "Whitesnake"),
    ],
    1988: [
        ("Sweet Child O Mine", "Guns N Roses"),
        ("Need You Tonight", "INXS"),
        ("I Should Be So Lucky", "Kylie Minogue"),
        ("Together Forever", "Rick Astley"),
        ("One More Try", "George Michael"),
        ("Monkey", "George Michael"),
        ("Roll with It", "Steve Winwood"),
        ("Look Away", "Chicago"),
        ("Pour Some Sugar on Me", "Def Leppard"),
        ("Anything for You", "Gloria Estefan"),
        ("Every Rose Has Its Thorn", "Poison"),
        ("Hands to Heaven", "Breathe"),
    ],
    1989: [
        ("Like a Prayer", "Madonna"),
        ("Eternal Flame", "The Bangles"),
        ("Ride on Time", "Black Box"),
        ("Wind of Change", "Scorpions"),
        ("Another Day in Paradise", "Phil Collins"),
        ("Straight Up", "Paula Abdul"),
        ("Right Here Waiting", "Richard Marx"),
        ("Girl You Know Its True", "Milli Vanilli"),
        ("Miss You Much", "Janet Jackson"),
        ("Batdance", "Prince"),
        ("Every Little Step", "Bobby Brown"),
        ("My Prerogative", "Bobby Brown"),
    ],
    1990: [
        ("Nothing Compares 2 U", "Sinead OConnor"),
        ("Vogue", "Madonna"),
        ("Ice Ice Baby", "Vanilla Ice"),
        ("U Cant Touch This", "MC Hammer"),
        ("Vision of Love", "Mariah Carey"),
        ("Hold On", "Wilson Phillips"),
        ("It Must Have Been Love", "Roxette"),
        ("Blaze of Glory", "Jon Bon Jovi"),
        ("Opposites Attract", "Paula Abdul"),
        ("Close to You", "Maxi Priest"),
        ("Because I Love You", "Stevie B"),
        ("Black Velvet", "Alannah Myles"),
    ],
    1991: [
        ("Everything I Do I Do It for You", "Bryan Adams"),
        ("Smells Like Teen Spirit", "Nirvana"),
        ("Black or White", "Michael Jackson"),
        ("Losing My Religion", "REM"),
        ("Gonna Make You Sweat", "C and C Music Factory"),
        ("One", "U2"),
        ("Rush Rush", "Paula Abdul"),
        ("Cream", "Prince"),
        ("Baby Baby", "Amy Grant"),
        ("I Wanna Sex You Up", "Color Me Badd"),
        ("More Than Words", "Extreme"),
        ("Justify My Love", "Madonna"),
    ],
    1992: [
        ("I Will Always Love You", "Whitney Houston"),
        ("Rhythm Is a Dancer", "Snap"),
        ("November Rain", "Guns N Roses"),
        ("End of the Road", "Boyz II Men"),
        ("Jump Around", "House of Pain"),
        ("Under the Bridge", "Red Hot Chili Peppers"),
        ("Save the Best for Last", "Vanessa Williams"),
        ("Baby Got Back", "Sir Mix a Lot"),
        ("To Be with You", "Mr Big"),
        ("Jump", "Kris Kross"),
        ("This Used to Be My Playground", "Madonna"),
        ("Tears in Heaven", "Eric Clapton"),
    ],
    1993: [
        ("I Will Always Love You", "Whitney Houston"),
        ("What Is Love", "Haddaway"),
        ("All That She Wants", "Ace of Base"),
        ("Id Do Anything for Love", "Meat Loaf"),
        ("Dreamlover", "Mariah Carey"),
        ("Whoomp There It Is", "Tag Team"),
        ("Informer", "Snow"),
        ("Weak", "SWV"),
        ("If I Ever Fall in Love", "Shai"),
        ("Freak Like Me", "Adina Howard"),
        ("Nuthin but a G Thang", "Dr Dre"),
        ("Runaway Train", "Soul Asylum"),
    ],
    1994: [
        ("Love Is All Around", "Wet Wet Wet"),
        ("Cotton Eye Joe", "Rednex"),
        ("Zombie", "The Cranberries"),
        ("The Sign", "Ace of Base"),
        ("I Swear", "All-4-One"),
        ("Stay", "Lisa Loeb"),
        ("Hero", "Mariah Carey"),
        ("All I Wanna Do", "Sheryl Crow"),
        ("Ill Make Love to You", "Boyz II Men"),
        ("Bump n Grind", "R Kelly"),
        ("Another Night", "Real McCoy"),
        ("Fantastic Voyage", "Coolio"),
    ],
    1995: [
        ("Gangstas Paradise", "Coolio"),
        ("Wonderwall", "Oasis"),
        ("Kiss from a Rose", "Seal"),
        ("Creep", "TLC"),
        ("Waterfalls", "TLC"),
        ("Fantasy", "Mariah Carey"),
        ("Take a Bow", "Madonna"),
        ("One Sweet Day", "Mariah Carey"),
        ("Gangsta's Paradise", "Coolio"),
        ("You Oughta Know", "Alanis Morissette"),
        ("Dont Take It Personal", "Monica"),
        ("Run-Around", "Blues Traveler"),
    ],
    1996: [
        ("Macarena", "Los Del Rio"),
        ("Killing Me Softly", "Fugees"),
        ("Wannabe", "Spice Girls"),
        ("One Sweet Day", "Mariah Carey"),
        ("Because You Loved Me", "Celine Dion"),
        ("Tha Crossroads", "Bone Thugs"),
        ("Nobody Knows", "Tony Rich Project"),
        ("Always Be My Baby", "Mariah Carey"),
        ("Give Me One Reason", "Tracy Chapman"),
        ("How Do U Want It", "2Pac"),
        ("You're Makin Me High", "Toni Braxton"),
        ("California Love", "2Pac"),
    ],
    1997: [
        ("Candle in the Wind", "Elton John"),
        ("MMMBop", "Hanson"),
        ("Barbie Girl", "Aqua"),
        ("Ill Be Missing You", "Puff Daddy"),
        ("Torn", "Natalie Imbruglia"),
        ("Honey", "Mariah Carey"),
        ("Quit Playing Games", "Backstreet Boys"),
        ("Return of the Mack", "Mark Morrison"),
        ("Wannabe", "Spice Girls"),
        ("Bitch", "Meredith Brooks"),
        ("You Were Meant for Me", "Jewel"),
        ("Tubthumping", "Chumbawamba"),
    ],
    1998: [
        ("My Heart Will Go On", "Celine Dion"),
        ("Believe", "Cher"),
        ("Iris", "Goo Goo Dolls"),
        ("The Boy Is Mine", "Brandy and Monica"),
        ("Too Close", "Next"),
        ("Truly Madly Deeply", "Savage Garden"),
        ("Gettin Jiggy wit It", "Will Smith"),
        ("Together Again", "Janet Jackson"),
        ("Youre Still the One", "Shania Twain"),
        ("Nice and Slow", "Usher"),
        ("How Do I Live", "LeAnn Rimes"),
        ("I Dont Want to Miss a Thing", "Aerosmith"),
    ],
    1999: [
        ("Baby One More Time", "Britney Spears"),
        ("Mambo No 5", "Lou Bega"),
        ("Livin la Vida Loca", "Ricky Martin"),
        ("I Want It That Way", "Backstreet Boys"),
        ("Genie in a Bottle", "Christina Aguilera"),
        ("Believe", "Cher"),
        ("No Scrubs", "TLC"),
        ("Angel of Mine", "Monica"),
        ("Smooth", "Santana"),
        ("Bills Bills Bills", "Destinys Child"),
        ("Unpretty", "TLC"),
        ("Every Morning", "Sugar Ray"),
    ],
    2000: [
        ("Its My Life", "Bon Jovi"),
        ("Oops I Did It Again", "Britney Spears"),
        ("Music", "Madonna"),
        ("Breathe", "Faith Hill"),
        ("Maria Maria", "Santana"),
        ("I Knew I Loved You", "Savage Garden"),
        ("Bye Bye Bye", "NSYNC"),
        ("It's Gonna Be Me", "NSYNC"),
        ("Say My Name", "Destiny's Child"),
        ("Incomplete", "Sisqo"),
        ("Kryptonite", "3 Doors Down"),
        ("Amazed", "Lonestar"),
    ],
    2001: [
        ("Cant Get You Out of My Head", "Kylie Minogue"),
        ("Lady Marmalade", "Christina Aguilera"),
        ("Fallin", "Alicia Keys"),
        ("Hanging by a Moment", "Lifehouse"),
        ("Drops of Jupiter", "Train"),
        ("It Wasnt Me", "Shaggy"),
        ("Bootylicious", "Destinys Child"),
        ("All for You", "Janet Jackson"),
        ("Survivor", "Destiny's Child"),
        ("Thank You", "Dido"),
        ("Im Real", "Jennifer Lopez"),
        ("Butterfly", "Crazy Town"),
    ],
    2002: [
        ("Complicated", "Avril Lavigne"),
        ("Whenever Wherever", "Shakira"),
        ("Without Me", "Eminem"),
        ("Foolish", "Ashanti"),
        ("How You Remind Me", "Nickelback"),
        ("Dilemma", "Nelly"),
        ("Hot in Herre", "Nelly"),
        ("Lose Yourself", "Eminem"),
        ("A Thousand Miles", "Vanessa Carlton"),
        ("In da Club", "50 Cent"),
        ("Sk8er Boi", "Avril Lavigne"),
        ("Cleanin Out My Closet", "Eminem"),
    ],
    2003: [
        ("Crazy in Love", "Beyonce"),
        ("In Da Club", "50 Cent"),
        ("Where Is the Love", "Black Eyed Peas"),
        ("Bring Me to Life", "Evanescence"),
        ("Get Busy", "Sean Paul"),
        ("Ignition", "R Kelly"),
        ("Beautiful", "Christina Aguilera"),
        ("Cry Me a River", "Justin Timberlake"),
        ("Numb", "Linkin Park"),
        ("Right Thurr", "Chingy"),
        ("Baby Boy", "Beyonce"),
        ("Hey Ya", "Outkast"),
    ],
    2004: [
        ("Yeah", "Usher"),
        ("Toxic", "Britney Spears"),
        ("Hey Ya", "Outkast"),
        ("This Love", "Maroon 5"),
        ("Burn", "Usher"),
        ("The Reason", "Hoobastank"),
        ("If I Aint Got You", "Alicia Keys"),
        ("Confessions Part II", "Usher"),
        ("Drop It Like Its Hot", "Snoop Dogg"),
        ("My Immortal", "Evanescence"),
        ("Breaking the Habit", "Linkin Park"),
        ("Goodies", "Ciara"),
    ],
    2005: [
        ("We Belong Together", "Mariah Carey"),
        ("Hollaback Girl", "Gwen Stefani"),
        ("Feel Good Inc", "Gorillaz"),
        ("Since U Been Gone", "Kelly Clarkson"),
        ("Gold Digger", "Kanye West"),
        ("Candy Shop", "50 Cent"),
        ("Boulevard of Broken Dreams", "Green Day"),
        ("1 2 Step", "Ciara"),
        ("Behind These Hazel Eyes", "Kelly Clarkson"),
        ("Dont Cha", "Pussycat Dolls"),
        ("Shake It Off", "Mariah Carey"),
        ("Hung Up", "Madonna"),
    ],
    2006: [
        ("Hips Dont Lie", "Shakira"),
        ("Crazy", "Gnarls Barkley"),
        ("SexyBack", "Justin Timberlake"),
        ("SOS", "Rihanna"),
        ("Bad Day", "Daniel Powter"),
        ("Promiscuous", "Nelly Furtado"),
        ("Temperature", "Sean Paul"),
        ("Maneater", "Nelly Furtado"),
        ("Deja Vu", "Beyonce"),
        ("Buttons", "Pussycat Dolls"),
        ("Ridin", "Chamillionaire"),
        ("Unfaithful", "Rihanna"),
    ],
    2007: [
        ("Umbrella", "Rihanna"),
        ("Bleeding Love", "Leona Lewis"),
        ("Rehab", "Amy Winehouse"),
        ("Stronger", "Kanye West"),
        ("Beautiful Girls", "Sean Kingston"),
        ("Girlfriend", "Avril Lavigne"),
        ("Hey There Delilah", "Plain White Ts"),
        ("Big Girls Dont Cry", "Fergie"),
        ("Irreplaceable", "Beyonce"),
        ("What Goes Around Comes Around", "Justin Timberlake"),
        ("Cupids Chokehold", "Gym Class Heroes"),
        ("Party Like a Rockstar", "Shop Boyz"),
    ],
    2008: [
        ("Viva la Vida", "Coldplay"),
        ("I Kissed a Girl", "Katy Perry"),
        ("Poker Face", "Lady Gaga"),
        ("Low", "Flo Rida"),
        ("Bleeding Love", "Leona Lewis"),
        ("No One", "Alicia Keys"),
        ("Love Story", "Taylor Swift"),
        ("Disturbia", "Rihanna"),
        ("Forever", "Chris Brown"),
        ("Lollipop", "Lil Wayne"),
        ("Take a Bow", "Rihanna"),
        ("I'm Yours", "Jason Mraz"),
    ],
    2009: [
        ("Poker Face", "Lady Gaga"),
        ("I Gotta Feeling", "Black Eyed Peas"),
        ("Bad Romance", "Lady Gaga"),
        ("Boom Boom Pow", "Black Eyed Peas"),
        ("Just Dance", "Lady Gaga"),
        ("Right Round", "Flo Rida"),
        ("Single Ladies", "Beyonce"),
        ("Use Somebody", "Kings of Leon"),
        ("Paparazzi", "Lady Gaga"),
        ("Down", "Jay Sean"),
        ("I Know You Want Me", "Pitbull"),
        ("Halo", "Beyonce"),
    ],
    2010: [
        ("Tik Tok", "Kesha"),
        ("Bad Romance", "Lady Gaga"),
        ("Love the Way You Lie", "Eminem"),
        ("California Gurls", "Katy Perry"),
        ("OMG", "Usher"),
        ("Dynamite", "Taio Cruz"),
        ("Telephone", "Lady Gaga"),
        ("Airplanes", "BOB"),
        ("Need You Now", "Lady Antebellum"),
        ("Nothin on You", "BOB"),
        ("Baby", "Justin Bieber"),
        ("Just the Way You Are", "Bruno Mars"),
    ],
    2011: [
        ("Someone Like You", "Adele"),
        ("Rolling in the Deep", "Adele"),
        ("Party Rock Anthem", "LMFAO"),
        ("Moves Like Jagger", "Maroon 5"),
        ("Give Me Everything", "Pitbull"),
        ("Firework", "Katy Perry"),
        ("E.T.", "Katy Perry"),
        ("Born This Way", "Lady Gaga"),
        ("Super Bass", "Nicki Minaj"),
        ("Pumped Up Kicks", "Foster the People"),
        ("Last Friday Night", "Katy Perry"),
        ("Fuck You", "Cee Lo Green"),
    ],
    2012: [
        ("Gangnam Style", "PSY"),
        ("Somebody That I Used to Know", "Gotye"),
        ("Call Me Maybe", "Carly Rae Jepsen"),
        ("We Are Young", "Fun"),
        ("Payphone", "Maroon 5"),
        ("Titanium", "David Guetta"),
        ("Starships", "Nicki Minaj"),
        ("Diamonds", "Rihanna"),
        ("Whistle", "Flo Rida"),
        ("Wide Awake", "Katy Perry"),
        ("Stronger", "Kelly Clarkson"),
        ("Glad You Came", "The Wanted"),
    ],
    2013: [
        ("Get Lucky", "Daft Punk"),
        ("Blurred Lines", "Robin Thicke"),
        ("Wake Me Up", "Avicii"),
        ("Roar", "Katy Perry"),
        ("Cant Hold Us", "Macklemore"),
        ("Wrecking Ball", "Miley Cyrus"),
        ("Royals", "Lorde"),
        ("Thrift Shop", "Macklemore"),
        ("Counting Stars", "OneRepublic"),
        ("Radioactive", "Imagine Dragons"),
        ("Mirrors", "Justin Timberlake"),
        ("The Fox", "Ylvis"),
    ],
    2014: [
        ("Happy", "Pharrell Williams"),
        ("Uptown Funk", "Mark Ronson"),
        ("All of Me", "John Legend"),
        ("Shake It Off", "Taylor Swift"),
        ("All About That Bass", "Meghan Trainor"),
        ("Rude", "Magic"),
        ("Dark Horse", "Katy Perry"),
        ("Stay with Me", "Sam Smith"),
        ("Chandelier", "Sia"),
        ("Fancy", "Iggy Azalea"),
        ("Blank Space", "Taylor Swift"),
        ("Problem", "Ariana Grande"),
    ],
    2015: [
        ("Uptown Funk", "Mark Ronson"),
        ("Hello", "Adele"),
        ("See You Again", "Wiz Khalifa"),
        ("Lean On", "Major Lazer"),
        ("Cant Feel My Face", "The Weeknd"),
        ("The Hills", "The Weeknd"),
        ("Cheerleader", "OMI"),
        ("Sugar", "Maroon 5"),
        ("Bad Blood", "Taylor Swift"),
        ("What Do You Mean", "Justin Bieber"),
        ("Hotline Bling", "Drake"),
        ("Watch Me", "Silento"),
    ],
    2016: [
        ("One Dance", "Drake"),
        ("Cheap Thrills", "Sia"),
        ("Closer", "The Chainsmokers"),
        ("Work", "Rihanna"),
        ("Cant Stop the Feeling", "Justin Timberlake"),
        ("Dont Let Me Down", "The Chainsmokers"),
        ("7 Years", "Lukas Graham"),
        ("Stressed Out", "Twenty One Pilots"),
        ("This Is What You Came For", "Calvin Harris"),
        ("Love Yourself", "Justin Bieber"),
        ("Sorry", "Justin Bieber"),
        ("Panda", "Desiigner"),
    ],
    2017: [
        ("Despacito", "Luis Fonsi"),
        ("Shape of You", "Ed Sheeran"),
        ("Something Just Like This", "The Chainsmokers"),
        ("HUMBLE", "Kendrick Lamar"),
        ("Rockstar", "Post Malone"),
        ("Thats What I Like", "Bruno Mars"),
        ("Believer", "Imagine Dragons"),
        ("Mask Off", "Future"),
        ("Stay", "Zedd"),
        ("It Aint Me", "Kygo"),
        ("Unforgettable", "French Montana"),
        ("Bodak Yellow", "Cardi B"),
    ],
    2018: [
        ("Gods Plan", "Drake"),
        ("In My Feelings", "Drake"),
        ("Havana", "Camila Cabello"),
        ("Perfect", "Ed Sheeran"),
        ("I Like It", "Cardi B"),
        ("Rockstar", "Post Malone"),
        ("One Kiss", "Calvin Harris"),
        ("Girls Like You", "Maroon 5"),
        ("Nice for What", "Drake"),
        ("Psycho", "Post Malone"),
        ("No Tears Left to Cry", "Ariana Grande"),
        ("God is a Woman", "Ariana Grande"),
    ],
    2019: [
        ("Old Town Road", "Lil Nas X"),
        ("Bad Guy", "Billie Eilish"),
        ("Senorita", "Shawn Mendes"),
        ("Dance Monkey", "Tones and I"),
        ("7 Rings", "Ariana Grande"),
        ("Sunflower", "Post Malone"),
        ("Sucker", "Jonas Brothers"),
        ("Truth Hurts", "Lizzo"),
        ("Thank U Next", "Ariana Grande"),
        ("Talk", "Khalid"),
        ("Happier", "Marshmello"),
        ("Without Me", "Halsey"),
    ],
    2020: [
        ("Blinding Lights", "The Weeknd"),
        ("Dance Monkey", "Tones and I"),
        ("The Box", "Roddy Ricch"),
        ("Rockstar", "DaBaby"),
        ("Watermelon Sugar", "Harry Styles"),
        ("Dont Start Now", "Dua Lipa"),
        ("Savage Love", "Jawsh 685"),
        ("WAP", "Cardi B"),
        ("Say So", "Doja Cat"),
        ("Roses", "SAINt JHN"),
        ("Adore You", "Harry Styles"),
        ("Rain on Me", "Lady Gaga"),
    ],
    2021: [
        ("Drivers License", "Olivia Rodrigo"),
        ("Stay", "The Kid Laroi"),
        ("Montero", "Lil Nas X"),
        ("good 4 u", "Olivia Rodrigo"),
        ("Levitating", "Dua Lipa"),
        ("Peaches", "Justin Bieber"),
        ("Kiss Me More", "Doja Cat"),
        ("Save Your Tears", "The Weeknd"),
        ("Industry Baby", "Lil Nas X"),
        ("Astronaut in the Ocean", "Masked Wolf"),
        ("Leave the Door Open", "Bruno Mars"),
        ("deja vu", "Olivia Rodrigo"),
    ],
    2022: [
        ("As It Was", "Harry Styles"),
        ("Heat Waves", "Glass Animals"),
        ("Running Up That Hill", "Kate Bush"),
        ("About Damn Time", "Lizzo"),
        ("First Class", "Jack Harlow"),
        ("Wait for U", "Future"),
        ("Me Porto Bonito", "Bad Bunny"),
        ("Super Freaky Girl", "Nicki Minaj"),
        ("I Aint Worried", "OneRepublic"),
        ("Unholy", "Sam Smith"),
        ("Late Night Talking", "Harry Styles"),
        ("Bad Habit", "Steve Lacy"),
    ],
    2023: [
        ("Flowers", "Miley Cyrus"),
        ("Kill Bill", "SZA"),
        ("Anti-Hero", "Taylor Swift"),
        ("Last Night", "Morgan Wallen"),
        ("Calm Down", "Rema"),
        ("Creepin", "Metro Boomin"),
        ("Die for You", "The Weeknd"),
        ("Vampire", "Olivia Rodrigo"),
        ("Cruel Summer", "Taylor Swift"),
        ("What Was I Made For", "Billie Eilish"),
        ("Karma", "Taylor Swift"),
        ("Ella Baila Sola", "Eslabon Armado"),
    ],
    2024: [
        ("Espresso", "Sabrina Carpenter"),
        ("Beautiful Things", "Benson Boone"),
        ("Lose Control", "Teddy Swims"),
        ("A Bar Song", "Shaboozey"),
        ("Not Like Us", "Kendrick Lamar"),
        ("Too Sweet", "Hozier"),
        ("I Had Some Help", "Post Malone"),
        ("Birds of a Feather", "Billie Eilish"),
        ("Taste", "Sabrina Carpenter"),
        ("Please Please Please", "Sabrina Carpenter"),
        ("Fortnight", "Taylor Swift"),
        ("We Can't Be Friends", "Ariana Grande"),
    ],
    2025: [
        ("Die With a Smile", "Lady Gaga"),
        ("APT", "ROSE"),
        ("Birds of a Feather", "Billie Eilish"),
        ("Sailor Song", "Gigi Perez"),
        ("Pink Pony Club", "Chappell Roan"),
        ("Good Luck Babe", "Chappell Roan"),
        ("Saturn", "SZA"),
        ("Luther", "Kendrick Lamar"),
        ("That's So True", "Gracie Abrams"),
        ("Yeah Glo", "GloRilla"),
        ("Timeless", "The Weeknd"),
        ("HOT TO GO", "Chappell Roan"),
    ],
}


def main():
    print("=" * 60)
    print("BeatGuessr Song Scraper v3")
    print("Using Spotify API + Embed Scraping")
    print("=" * 60)

    contexts = load_contexts()
    print(f"Loaded {len(contexts)} contexts")

    spotify = SpotifyAPI(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET)

    if HAS_SCRAPER:
        print("Using spotifyscraper library for previews")
        scraper_client = SpotifyClient()
    else:
        print("Using direct embed scraping for previews")
        scraper_client = None

    all_songs = []
    songs_without_preview = []
    year_counts = {}

    for year in range(START_YEAR, END_YEAR + 1):
        print(f"\n{'=' * 40}")
        print(f"Processing year: {year}")
        print(f"{'=' * 40}")

        candidates = FALLBACK_DB.get(year, [])
        print(f"  Candidates: {len(candidates)}")

        year_songs = []

        for title, artist in candidates:
            if len(year_songs) >= MIN_SONGS_PER_YEAR + 2:
                break

            if is_excluded_title(title):
                continue

            print(f"  {title} - {artist}...", end=" ", flush=True)
            time.sleep(REQUEST_DELAY)

            try:
                # Search via API
                tracks = spotify.search_track(title, artist)

                if not tracks:
                    print("NOT FOUND")
                    continue

                # Find best match
                best_track = None
                for track in tracks:
                    track_title = track.get("name", "").lower()
                    if not is_excluded_title(track_title):
                        best_track = track
                        break

                if not best_track:
                    best_track = tracks[0]

                track_id = best_track.get("id")
                track_url = f"https://open.spotify.com/track/{track_id}"

                # Try to get preview URL
                preview_url = None

                # Method 1: Try spotifyscraper library
                if HAS_SCRAPER and scraper_client:
                    try:
                        track_info = scraper_client.get_track_info(track_url)
                        if track_info:
                            preview_url = track_info.get("preview_url")
                    except:
                        pass

                # Method 2: Try embed scraping
                if not preview_url:
                    preview_url = get_preview_url_from_embed(track_id)

                if not preview_url:
                    print("NO PREVIEW")
                    songs_without_preview.append(f"'{title}' by {artist} ({year})")
                    continue

                # Get album info
                album = best_track.get("album", {})
                images = album.get("images", [])
                cover_url = images[0].get("url") if images else None

                release_date = album.get("release_date", str(year))
                try:
                    actual_year = int(release_date[:4])
                except:
                    actual_year = year

                artists = best_track.get("artists", [])
                artist_name = artists[0].get("name", artist) if artists else artist

                # Use the chart year (from our curated list), not the album release year
                # This ensures the game uses when the song was a HIT, not when it was rereleased
                song_data = {
                    "id": track_id,
                    "title": best_track.get("name", title),
                    "artist": artist_name,
                    "year": year,  # Use chart year, not album release year
                    "context": contexts.get(str(year), f"Charts {year}"),
                    "preview_url": preview_url,
                    "cover_url": cover_url,
                    "album": album.get("name", ""),
                    "spotify_url": track_url,
                }

                year_songs.append(song_data)
                print(f"OK")

            except Exception as e:
                print(f"ERROR: {e}")

        all_songs.extend(year_songs[:MIN_SONGS_PER_YEAR])
        year_counts[year] = min(len(year_songs), MIN_SONGS_PER_YEAR)
        print(f"  Collected: {year_counts[year]} songs")

    if HAS_SCRAPER and scraper_client:
        scraper_client.close()

    # Save
    output_data = {
        "songs": all_songs,
        "contexts": contexts,
        "metadata": {
            "total_songs": len(all_songs),
            "scraped_at": datetime.now().isoformat(),
            "year_range": [START_YEAR, END_YEAR],
            "year_distribution": year_counts,
        },
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print(f"SUMMARY")
    print(f"{'=' * 60}")
    print(f"Total songs: {len(all_songs)}")
    print(f"Songs without preview: {len(songs_without_preview)}")

    complete = sum(1 for c in year_counts.values() if c >= MIN_SONGS_PER_YEAR)
    print(f"Years with 10+ songs: {complete}/{END_YEAR - START_YEAR + 1}")

    if songs_without_preview:
        print(f"\nMissing previews:")
        for s in songs_without_preview[:10]:
            print(f"  - {s}")
        if len(songs_without_preview) > 10:
            print(f"  ... and {len(songs_without_preview) - 10} more")


if __name__ == "__main__":
    main()
