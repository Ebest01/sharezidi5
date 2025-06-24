import React from 'react';
import { Progress } from './ui/progress';
import { FileArchive, Loader2 } from 'lucide-react';

interface ZipProgressProps {
  isZipping: boolean;
  progress?: number;
  fileName?: string;
}

export const ZipProgress: React.FC<ZipProgressProps> = ({ 
  isZipping, 
  progress = 0, 
  fileName 
}) => {
  if (!isZipping) return null;

  return (
    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950 dark:border-blue-800">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <FileArchive className="h-4 w-4 text-blue-600" />
        </div>
        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
          Creating ZIP archive...
        </span>
      </div>
      
      {fileName && (
        <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
          {fileName}
        </p>
      )}
      
      <Progress value={progress} className="h-2" />
      
      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
        Compressing files for faster transfer
      </p>
    </div>
  );
};