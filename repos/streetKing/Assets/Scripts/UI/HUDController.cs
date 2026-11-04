using StreetKing.Core;
using TMPro;
using UnityEngine;

namespace StreetKing.UI
{
    public class HUDController : MonoBehaviour
    {
        [SerializeField] private TMP_Text scoreText;
        [SerializeField] private TMP_Text rallyText;
        [SerializeField] private TMP_Text winnerText;
        [SerializeField] private TMP_Text hypeText;

        public void SetScore(int p1, int p2)
        {
            if (scoreText != null) scoreText.text = $"{p1} - {p2}";
        }

        public void SetRally(int rally)
        {
            if (rallyText != null) rallyText.text = $"RALLY x{rally}";
        }

        public void SetWinner(string winner)
        {
            if (winnerText != null) winnerText.text = $"{winner} WINS";
        }

        public void SetHype(RallyIntensity intensity)
        {
            if (hypeText == null) return;
            hypeText.text = intensity switch
            {
                RallyIntensity.Calm => "READY",
                RallyIntensity.Hot => "HEATING UP",
                RallyIntensity.Blazing => "BLAZING",
                RallyIntensity.Overdrive => "OVERDRIVE!",
                _ => "READY"
            };
        }
    }
}
