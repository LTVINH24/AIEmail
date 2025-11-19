import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-800">404</h1>
        <p className="text-2xl font-light text-gray-600 mb-4">Page Not Found</p>
        <p className="text-gray-500 mb-8">Sorry, the page you are looking for does not exist.</p>
        <Link
          to="/"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Go Back to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
