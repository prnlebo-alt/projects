using UnityEngine;

namespace StreetKing.Core
{
    public class CameraJuice : MonoBehaviour
    {
        [SerializeField] private Transform cameraRoot;
        [SerializeField] private float smoothReturnSpeed = 18f;

        private float _shakeTime;
        private float _shakeMagnitude;
        private Vector3 _baseLocalPos;

        private void Awake()
        {
            if (cameraRoot == null) cameraRoot = transform;
            _baseLocalPos = cameraRoot.localPosition;
        }

        private void LateUpdate()
        {
            if (_shakeTime > 0f)
            {
                _shakeTime -= Time.deltaTime;
                cameraRoot.localPosition = _baseLocalPos + (Vector3)(Random.insideUnitCircle * _shakeMagnitude);
            }
            else
            {
                cameraRoot.localPosition = Vector3.Lerp(cameraRoot.localPosition, _baseLocalPos, Time.deltaTime * smoothReturnSpeed);
            }
        }

        public void Shake(float duration, float magnitude)
        {
            _shakeTime = Mathf.Max(_shakeTime, duration);
            _shakeMagnitude = Mathf.Max(_shakeMagnitude, magnitude);
        }
    }
}
