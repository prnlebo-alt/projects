interface ShareButtonProps {
  onError: (message: string) => void;
}

export default function ShareButton({ onError }: ShareButtonProps) {
  return (
    <button
      className="secondary-button"
      type="button"
      onClick={() => {
        chrome.runtime.sendMessage({ action: 'refreshActiveTabTheme' }, () => {
          onError('Share capture is blocked until the security policy allows screenshots.');
        });
      }}
    >
      Share setup
    </button>
  );
}
