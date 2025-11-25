import React, { useState } from 'react';
import { useUsers } from '../hooks/useDatabase';
import { Button } from '@mantine/core';

function App() {
  const { users, loading, createUser, deleteUser } = useUsers();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userEmail) return;

    try {
      await createUser({ name: userName, email: userEmail });
      setUserName('');
      setUserEmail('');
    } catch (error) {
      console.error('Failed to create user:', error);
      alert('Failed to create user. Check console for details.');
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      await deleteUser(id);
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user. Check console for details.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-2">
            Turbo Julius
          </h1>
          <p className="text-gray-600 text-lg">
            Electron + Vite + React + Tailwind CSS + Drizzle ORM
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Users Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">
              Users
            </h2>

            {/* Create User Form */}
            <form onSubmit={handleCreateUser} className="mb-6 space-y-3">
              <input
                type="text"
                placeholder="Name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button type="submit" variant="filled">Add User</Button>
            </form>

            {/* Users List */}
            {loading ? (
              <p className="text-gray-500">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No users yet. Create one above!
              </p>
            ) : (
              <ul className="space-y-2">
                {users.map((user) => (
                  <li
                    key={user.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Info Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">
              Features
            </h2>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span className="text-gray-700">
                  <strong>React 19</strong> with TypeScript
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span className="text-gray-700">
                  <strong>Tailwind CSS</strong> for styling
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span className="text-gray-700">
                  <strong>Drizzle ORM</strong> with SQLite database
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span className="text-gray-700">
                  <strong>Type-safe IPC</strong> communication
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span className="text-gray-700">
                  <strong>Electron Forge</strong> for packaging
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span className="text-gray-700">
                  <strong>Vite</strong> for fast development
                </span>
              </li>
            </ul>

            <div className="mt-6 p-4 bg-blue-50 rounded-md">
              <p className="text-sm text-gray-700">
                <strong>Try it out:</strong> Add some users using the form on
                the left. The data is stored in a SQLite database in your user
                data directory and persists between app restarts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
