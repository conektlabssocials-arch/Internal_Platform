import Button from './Button';

const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-4" role="alert">
    <p className="font-medium text-red-800">Something went wrong</p>
    <p className="mt-1 text-sm text-red-700">{message}</p>
    {onRetry ? (
      <Button variant="secondary" onClick={onRetry} className="mt-3">
        Retry
      </Button>
    ) : null}
  </div>
);

export default ErrorState;
