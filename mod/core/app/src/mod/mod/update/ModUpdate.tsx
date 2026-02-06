"use client";
import React, { useState } from 'react';

interface ModUpdateProps {
  mod?: any;
  onUpdate?: (data: any) => void;
}

const ModUpdate: React.FC<ModUpdateProps> = ({ mod, onUpdate }) => {
  const [loading, setLoading] = useState(false);

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">Module Update</h2>
      {mod ? (
        <div>
          <p>Module: {mod.name || 'Unknown'}</p>
          {loading && <p>Updating...</p>}
        </div>
      ) : (
        <p>No module selected</p>
      )}
    </div>
  );
};

export default ModUpdate;
